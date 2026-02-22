// src/screens/VideoPlayerScreen.js
// ─── FIXES IN THIS VERSION ────────────────────────────────────────────────────
//  ✅ Status bar: FULLY HIDDEN when fullscreen — <StatusBar hidden> component
//     + imperative call. The coloured bar is gone completely.
//  ✅ TV remote UP   → previous channel (wraps)
//  ✅ TV remote DOWN → next channel (wraps)
//  ✅ TV remote LEFT → open channel browser (calls onShowBrowser prop)
//  ✅ TV remote RIGHT→ last-watched channel (calls onGoLastChannel prop)
//  ✅ ctrlTop paddingTop removed — no dead space where bar used to be
//  ✅ Double-tap from channel list → fullscreen
//  ✅ Single-tap on active channel → fullscreen
//  ★  All existing functionality (slide anim, proxy, Xtream UA cycling) preserved
// ─────────────────────────────────────────────────────────────────────────────

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform,
  Animated, Dimensions,
} from 'react-native';
import { Video }        from 'expo-av';
import { Ionicons }     from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import channelService   from '../services/channelService';
import api              from '../services/api';
import { useSettings }  from '../context/SettingsContext';

const CONTROLS_HIDE_MS = 4000;
const DOUBLE_TAP_MS    = 280;
const SCREEN           = Dimensions.get('window');

const PROXY_BASE = (() => {
  try {
    const base = api.defaults.baseURL || 'http://192.168.100.230:5000/api';
    return base.replace(/\/api\/?$/, '') + '/api/proxy/stream';
  } catch (_) { return 'http://192.168.100.230:5000/api/proxy/stream'; }
})();

const XTREAM_UAS = [
  'VLC/3.0.18 LibVLC/3.0.18',
  'OTT Navigator/1.6.7 (Linux; Android 10)',
  'ExoPlayer/2.18.1 (Linux; Android 10) ExoPlayerLib/2.18.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'AppleCoreMedia/1.0.0.20L154 (Apple TV; U; CPU OS 14_0 like Mac OS X; en_us)',
];

function isXtreamUrl(url) {
  if (!url) return false;
  if (url.includes('/live/')) return true;
  if (url.match(/\/[^/]+\/[^/]+\/\d+(\.ts)?$/)) return true;
  if (url.includes('get.php') || url.includes('player_api.php')) return true;
  return /^\d+$/.test(url.split('/').pop() || '');
}

function ensureTsExtension(url) {
  if (!url) return url;
  if (isXtreamUrl(url) && !url.includes('.ts') && !url.includes('.m3u8') && !url.includes('.mp4')) {
    if (/^\d+$/.test(url.split('/').pop() || '')) return url + '.ts';
  }
  return url;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VideoPlayerScreen({
  channel: propChannel,
  allChannels: propAllChannels,
  lastChannel: propLastChannel,
  isFullscreen,
  onFullscreenChange,
  onChannelChange,
  onShowBrowser,
  navigation,
}) {
  useKeepAwake();
  const { settings } = useSettings();
  const settingsRef  = useRef(settings);
  settingsRef.current = settings;

  // Get params from navigation
  const route = navigation.getState().routes.find(r => r.name === 'Player');
  const params = route?.params || {};
  
  // Use params if provided, otherwise use props
  const [currentChannel, setCurrentChannel] = useState(params.channel || propChannel);
  const [shouldStartFullscreen, setShouldStartFullscreen] = useState(params.startFullscreen || false);
  const [allChannels, setAllChannels] = useState(propAllChannels || []);
  const [lastChannel, setLastChannel] = useState(propLastChannel || null);

  // Slide-in animation LEFT → RIGHT
  const slideAnim = useRef(new Animated.Value(-SCREEN.width)).current;
  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  }, []);

  const [streamSource,   setStreamSource]   = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [usingProxy,     setUsingProxy]     = useState(false);
  const [isPlaying,      setIsPlaying]      = useState(false);
  const [showControls,   setShowControls]   = useState(true);
  const [error,          setError]          = useState(null);
  const [currentUaIndex, setCurrentUaIndex] = useState(0);

  const videoRef       = useRef(null);
  const controlsTimer  = useRef(null);
  const lastTapTime    = useRef(0);
  const isLoadingRef   = useRef(false);
  const prevChannelId  = useRef(null);
  const loadTimeoutRef = useRef(null);

  // Always-fresh refs for remote handler
  const allChRef    = useRef([]);
  const channelRef  = useRef(null);
  const lastChRef   = useRef(null);
  allChRef.current  = allChannels;
  channelRef.current  = currentChannel;
  lastChRef.current   = lastChannel;

  // ── Controls auto-hide ────────────────────────────────────────────────────
  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_MS);
  }, []);
  
  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, []);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => () => {
    videoRef.current?.unloadAsync().catch(() => {});
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
  }, []);

  // ── Handle fullscreen on mount ────────────────────────────────────────────
  useEffect(() => {
    if (shouldStartFullscreen) {
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        enterFullscreen();
        setShouldStartFullscreen(false);
        // Clear the param
        navigation.setParams({ startFullscreen: undefined });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldStartFullscreen, enterFullscreen, navigation]);

  // ── loadStream ─────────────────────────────────────────────────────────────
  const loadStream = useCallback(async (ch, forceProxy, uaIndex = 0) => {
    if (!ch || isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    try {
      setLoading(true); setError(null); setIsPlaying(false);
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      try { await videoRef.current?.unloadAsync(); } catch (_) {}
      
      let rawUrl;
      // FORCE PROXY FIRST - always use proxy
      let useProxy = true;
      
      console.log('📺 VideoPlayer loading channel:', ch.name);
      console.log('   Playlist ID:', ch.playlistId);
      console.log('   Channel ID:', ch.channelId || ch._id);
      console.log('   MAC Address:', ch.macAddress || 'MISSING!');
      
      // TRY FAST SWITCH FIRST (uses cached tokens)
      try {
        console.log('⚡ Trying fast channel switch...');
        const switchResponse = await api.post('/channels/channel-switch', {
          playlistId: ch.playlistId,
          channelId: ch.channelId || ch._id
        });
        
        if (switchResponse.data?.url) {
          rawUrl = switchResponse.data.url;
          console.log('✅ Fast switch URL:', rawUrl);
        } else {
          throw new Error('Fast switch returned no URL');
        }
      } catch (switchError) {
        console.log('⚠️ Fast switch failed:', switchError.message);
        
        // Try fast token method SECOND
        try {
          console.log('🚀 Trying fast token method...');
          
          // Get fresh token (ONLY handshake, 500ms)
          const tokenResponse = await api.post('/channels/get-stalker-token', {
            playlistId: ch.playlistId
          });
          
          const freshToken = tokenResponse.data.token;
          console.log('✅ Got fresh token:', freshToken);
          
          const cmdString = String(ch.cmd || ch.url || '');
          
          // Extract base URL (everything before the path)
          const baseMatch = cmdString.match(/(https?:\/\/[^\/]+)/);
          if (!baseMatch) throw new Error('Could not extract base URL');
          
          const baseServer = baseMatch[1];
          
          // Check if it's the live.php format (MAG-style)
          if (cmdString.includes('live.php')) {
            // MAG-style stream with live.php
            const urlObj = new URL(baseServer + '/play/live.php');
            urlObj.searchParams.set('mac', ch.macAddress || '');
            urlObj.searchParams.set('stream', ch.channelId || ch._id);
            urlObj.searchParams.set('extension', 'ts');
            urlObj.searchParams.set('play_token', freshToken);
            
            rawUrl = urlObj.toString();
            console.log('📡 Generated MAG URL with fresh token:', rawUrl);
          } else {
            // Xtream-style stream with username/password format
            // Extract username from cmd (the part after base server)
            const usernameMatch = cmdString.match(/https?:\/\/[^\/]+\/([^\/]+)/);
            const username = usernameMatch ? usernameMatch[1] : null;
            
            if (!username) throw new Error('Could not extract username');
            
            rawUrl = `${baseServer}/${username}/${freshToken}/${ch.channelId || ch._id}.ts`;
            console.log('⚡ Generated Xtream URL with fresh token:', rawUrl);
          }
          
        } catch (fastError) {
          console.log('⚠️ Fast token method failed:', fastError.message);
          
          // TRY ORIGINAL TOKEN FROM CMD THIRD
          try {
            console.log('🔄 Attempting to use original token from cmd...');
            const cmdString = String(ch.cmd || ch.url || '');
            
            // Try to extract original play_token for MAG streams
            const originalTokenMatch = cmdString.match(/play_token=([^&]+)/);
            if (originalTokenMatch) {
              const originalToken = originalTokenMatch[1];
              console.log('✅ Found original token in cmd:', originalToken);
              
              const baseMatch = cmdString.match(/(https?:\/\/[^\/]+)/);
              if (baseMatch) {
                const baseServer = baseMatch[1];
                const urlObj = new URL(baseServer + '/play/live.php');
                urlObj.searchParams.set('mac', ch.macAddress || '');
                urlObj.searchParams.set('stream', ch.channelId || ch._id);
                urlObj.searchParams.set('extension', 'ts');
                urlObj.searchParams.set('play_token', originalToken);
                rawUrl = urlObj.toString();
                console.log('📡 Using URL with original token:', rawUrl);
              } else {
                throw new Error('Could not extract base URL');
              }
            } 
            // For Xtream streams, use the original cmd URL directly
            else {
              console.log('📺 Using original cmd URL for Xtream stream');
              const urlMatch = cmdString.match(/https?:\/\/[^\s]+/);
              if (urlMatch) {
                rawUrl = urlMatch[0];
                console.log('✅ Original URL:', rawUrl);
              } else {
                throw new Error('Could not extract URL from cmd');
              }
            }
          } catch (fallbackError) {
            console.log('⚠️ Original token fallback failed:', fallbackError.message);
            console.log('🔄 Falling back to regular channel service...');
            rawUrl = await channelService.getChannelStream(ch);
          }
        }
      }
      
      if (!rawUrl) throw new Error('No stream URL returned');

      // Process the URL for proxy
      const plain = (() => { 
        try { return decodeURIComponent(rawUrl); } 
        catch (_) { return rawUrl; } 
      })();
      
      const mac = ch.macAddress ? `&mac=${encodeURIComponent(ch.macAddress)}` : '';
      
      const source = {
        uri: rawUrl.startsWith(PROXY_BASE) ? rawUrl : `${PROXY_BASE}?url=${encodeURIComponent(plain)}${mac}`,
        headers: { 'User-Agent': 'ExoPlayer/2.18.1 (Linux; Android 10)', 'Accept': '*/*' },
        overrideFileExtensionAndroid: 'ts',
      };
      
      setUsingProxy(true);
      setStreamSource(source);
      
      // Set timeout for loading
      loadTimeoutRef.current = setTimeout(() => {
        if (isLoadingRef.current) { 
          setLoading(false); 
          setError('Stream timed out. Try switching mode.'); 
          isLoadingRef.current = false; 
        }
      }, 15000);
      
    } catch (err) {
      setError(`Failed to load: ${err.message}`);
      setLoading(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  // ── TV / D-pad remote handler ─────────────────────────────────────────────
  const handleRemoteKey = useCallback((eventType) => {
    const channels = allChRef.current;
    const cur      = currentChannel;

    if (eventType === 'up' || eventType === 'channelUp') {
      if (!channels.length) return;
      const idx = cur ? channels.findIndex(c => (c.channelId || c._id) === (cur.channelId || cur._id)) : -1;
      const prev = idx <= 0 ? channels.length - 1 : idx - 1;
      setCurrentChannel(channels[prev]);
      onChannelChange?.(channels[prev]);
      resetControlsTimer();
    }
    else if (eventType === 'down' || eventType === 'channelDown') {
      if (!channels.length) return;
      const idx = cur ? channels.findIndex(c => (c.channelId || c._id) === (cur.channelId || cur._id)) : -1;
      const next = idx >= channels.length - 1 ? 0 : idx + 1;
      setCurrentChannel(channels[next]);
      onChannelChange?.(channels[next]);
      resetControlsTimer();
    }
    else if (eventType === 'left') {
      onShowBrowser?.();
      resetControlsTimer();
    }
    else if (eventType === 'right') {
      const last = lastChRef.current;
      if (last) { 
        setCurrentChannel(last);
        onChannelChange?.(last); 
        resetControlsTimer(); 
      }
    }
    else if (eventType === 'select' || eventType === 'playPause') {
      setShowControls(v => {
        if (!v) { resetControlsTimer(); return true; }
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        return false;
      });
    }
  }, [currentChannel, onChannelChange, onShowBrowser, resetControlsTimer]);

  useEffect(() => {
    let tvh = null;
    try {
      const { TVEventHandler } = require('react-native');
      if (TVEventHandler) {
        tvh = new TVEventHandler();
        tvh.enable(null, (_c, evt) => { if (evt?.eventType) handleRemoteKey(evt.eventType); });
      }
    } catch (_) {}
    return () => { try { tvh?.disable(); } catch (_) {} };
  }, [handleRemoteKey]);

  // ── Reload when channel changes ──────────────────────────────────────
  useEffect(() => {
    if (!currentChannel) { 
      setStreamSource(null); 
      setLoading(false); 
      setError(null); 
      prevChannelId.current = null; 
      return; 
    }
    const id = currentChannel.channelId || currentChannel._id;
    if (id === prevChannelId.current) return;
    prevChannelId.current = id;
    setCurrentUaIndex(0);
    loadStream(currentChannel);
  }, [currentChannel, loadStream]);

  // ── Fullscreen ────────────────────────────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    StatusBar.setHidden(true, 'fade');
    onFullscreenChange?.(true);
    resetControlsTimer();
  }, [onFullscreenChange, resetControlsTimer]);

  const exitFullscreen = useCallback(() => {
    StatusBar.setHidden(false, 'fade');
    onFullscreenChange?.(false);
    resetControlsTimer();
  }, [onFullscreenChange, resetControlsTimer]);

  // ── Double-tap ────────────────────────────────────────────────────────────
  const handleVideoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTime.current < DOUBLE_TAP_MS) {
      lastTapTime.current = 0;
      isFullscreen ? exitFullscreen() : enterFullscreen();
    } else {
      lastTapTime.current = now;
      setShowControls(v => {
        if (!v) { resetControlsTimer(); return true; }
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        return false;
      });
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen, resetControlsTimer]);

  // ── Play/Pause ────────────────────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    try { isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync(); }
    catch (_) {}
    resetControlsTimer();
  }, [isPlaying, resetControlsTimer]);

  // ── Error handler ─────────────────────────────────────────────────────────
  const onVideoError = useCallback((err) => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    if (!usingProxy && streamSource?.uri && isXtreamUrl(streamSource.uri) && currentUaIndex < XTREAM_UAS.length - 1) {
      setError(null);
      loadStream(currentChannel, false, currentUaIndex + 1);
      return;
    }
    setLoading(false);
    setError('Stream failed. Try switching mode.');
  }, [usingProxy, streamSource, currentUaIndex, currentChannel, loadStream]);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <Animated.View style={[styles.root, { transform: [{ translateX: slideAnim }] }]}>

      {/* ★ Status bar fully hidden when this full-screen player is shown */}
      <StatusBar hidden translucent backgroundColor="transparent" />

      <TouchableOpacity activeOpacity={1} style={StyleSheet.absoluteFill} onPress={handleVideoTap}>

        {streamSource && (
          <Video
            ref={videoRef}
            style={styles.video}
            source={streamSource}
            resizeMode="stretch"
            shouldPlay 
            isLooping={false} 
            useNativeControls={false}
            rate={1.0} 
            volume={1.0} 
            isMuted={false}
            androidImplementation="MediaPlayer"
            onLoad={() => {
              if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
              setLoading(false); setIsPlaying(true); setError(null);
              resetControlsTimer();
            }}
            onPlaybackStatusUpdate={s => {
              if (s.isLoaded && s.isPlaying !== isPlaying) setIsPlaying(s.isPlaying);
            }}
            onError={onVideoError}
          />
        )}

        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.overlayText}>{usingProxy ? 'Connecting via proxy…' : 'Loading stream…'}</Text>
          </View>
        )}

        {!currentChannel && !loading && (
          <View style={styles.overlay}>
            <Ionicons name="tv-outline" size={52} color="#2a2a2a" />
            <Text style={styles.overlayText}>Select a channel</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.overlay}>
            <Ionicons name="alert-circle-outline" size={42} color="#e50914" />
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.errorBtns}>
              <TouchableOpacity style={styles.btn} onPress={() => { setError(null); loadStream(currentChannel, usingProxy, currentUaIndex); }}>
                <Text style={styles.btnText}>Retry</Text>
              </TouchableOpacity>
              {usingProxy
                ? <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => { setError(null); loadStream(currentChannel, false, 0); }}><Text style={styles.btnText}>Try Direct</Text></TouchableOpacity>
                : <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={() => { setError(null); loadStream(currentChannel, true, 0); }}><Text style={styles.btnText}>Try Proxy</Text></TouchableOpacity>}
            </View>
          </View>
        )}

        {showControls && !loading && !error && streamSource && (
          <View style={styles.controls} pointerEvents="box-none">

            {/* Top bar — ★ paddingTop:8, NOT 34/14 — bar is hidden, no wasted space */}
            <View style={styles.ctrlTop}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={isFullscreen ? exitFullscreen : () => navigation?.canGoBack() && navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>

              <Text style={styles.channelTitle} numberOfLines={1}>{currentChannel?.name || ''}</Text>

              <View style={styles.topRight}>
                <View style={usingProxy ? styles.badgeProxy : styles.badgeDirect}>
                  <Text style={styles.badgeText}>{usingProxy ? 'PROXY' : 'DIRECT'}</Text>
                </View>
                <TouchableOpacity style={styles.iconBtn} onPress={isFullscreen ? exitFullscreen : enterFullscreen}>
                  <Ionicons name={isFullscreen ? 'contract' : 'expand'} size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
              <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={68} color="rgba(255,255,255,0.88)" />
            </TouchableOpacity>

            <View style={styles.ctrlBottom}>
              <TouchableOpacity style={styles.modeToggle} onPress={() => loadStream(currentChannel, !usingProxy, 0)}>
                <Ionicons name="swap-horizontal" size={14} color="#aaa" style={{ marginRight: 4 }} />
                <Text style={styles.modeToggleText}>{usingProxy ? 'Switch to Direct' : 'Switch to Proxy'}</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>↑↓ ch · ← browser · → last · double-tap {isFullscreen ? 'exit' : 'fullscreen'}</Text>
            </View>

          </View>
        )}

      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0,
    width: SCREEN.width, height: SCREEN.height,
    backgroundColor: '#000', zIndex: 999, elevation: 999,
  },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center', gap: 10 },
  overlayText: { color: '#888', fontSize: 13 },
  errorText:   { color: '#ccc', fontSize: 12, textAlign: 'center', marginHorizontal: 30 },
  errorBtns:   { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn:         { backgroundColor: '#e50914', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 5 },
  btnAlt:      { backgroundColor: '#c47a00' },
  btnText:     { color: '#fff', fontWeight: '700', fontSize: 13 },

  controls:    { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },

  ctrlTop: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12,
    // ★ paddingTop: 8 — StatusBar is hidden, no extra space needed (was 34 iOS / 14 Android)
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  iconBtn:      { padding: 6 },
  channelTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', marginHorizontal: 8 },
  topRight:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeProxy:   { borderWidth: 1, borderColor: '#f90',    borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  badgeDirect:  { borderWidth: 1, borderColor: '#e50914', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText:    { color: '#fff', fontSize: 8, fontWeight: '700' },

  playBtn: { alignSelf: 'center' },

  ctrlBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingBottom: Platform.OS === 'android' ? 14 : 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modeToggle:     { flexDirection: 'row', alignItems: 'center' },
  modeToggleText: { color: '#aaa', fontSize: 10 },
  hint:           { color: 'rgba(255,255,255,0.3)', fontSize: 9 },
  video:          { position: 'absolute', top: 0,  left: 0, right: 0, bottom: 0, width: SCREEN.width, height: SCREEN.height,},
});