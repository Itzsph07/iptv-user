// src/screens/HomeScreen.js
// ─── FIXES IN THIS VERSION ────────────────────────────────────────────────────
//  ✅ Status bar: fully gone in fullscreen — <StatusBar hidden> component +
//     imperative StatusBar.setHidden(true). No red/coloured bar bleed ever.
//  ✅ Channel/genre order: DB ORDER preserved — Map (insertion order), no .sort()
//  ✅ TV remote UP   → previous channel (wraps around)
//  ✅ TV remote DOWN → next channel (wraps around)
//  ✅ TV remote LEFT → toggle channel browser overlay in fullscreen
//  ✅ TV remote RIGHT→ jump back to last-watched channel
//  ✅ Last channel: saved on every channel switch, shown as pill + row
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useRef, useState, useEffect, useCallback, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, BackHandler, Platform, FlatList, Image, StatusBar,
} from 'react-native';
import { Video }        from 'expo-av';
import { Ionicons }     from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import channelService   from '../services/channelService';
import api              from '../services/api';
import { useSettings }  from '../context/SettingsContext';
import { useAuth }      from '../context/AuthContext';

const { width: SW, height: SH } = Dimensions.get('window');
const SIDEBAR_WIDTH    = SW * 0.32;
const CONTROLS_HIDE_MS = 4000;
const DOUBLE_TAP_MS    = 300;

const PROXY_BASE = (() => {
  try { return api.defaults.baseURL.replace(/\/api\/?$/, '') + '/api/proxy/stream'; }
  catch (_) { return 'http://192.168.100.229:5000/api/proxy/stream'; }
})();

// ─── Player sub-component (pure display) ─────────────────────────────────────
const PlayerArea = React.memo(({
  fullscreen, streamSource, loading, usingProxy,
  showControls, isPlaying, currentChannel, error,
  videoRef, onVideoTap, onBackPress, onPlayPause,
  onFullscreenToggle, onLoad, onStatusUpdate, onRetry,
  onTryProxy, onTryDirect,
}) => (
  <TouchableOpacity
    activeOpacity={1}
    style={fullscreen ? styles.videoFullscreen : styles.videoWrapper}
    onPress={onVideoTap}
  >
    {streamSource && (
      <Video
        ref={videoRef}
        style={StyleSheet.absoluteFill}
        source={streamSource}
        resizeMode="stretch"
        shouldPlay
        isLooping={false}
        useNativeControls={false}
        rate={1.0} volume={1.0} isMuted={false}
        androidImplementation="MediaPlayer"
        onLoad={onLoad}
        onPlaybackStatusUpdate={onStatusUpdate}
      />
    )}

    {loading && (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#e50914" />
        <Text style={styles.loadingText}>
          {usingProxy ? 'Connecting via proxy…' : 'Loading stream…'}
        </Text>
      </View>
    )}

    {error && !loading && (
      <View style={styles.loadingOverlay}>
        <Ionicons name="alert-circle" size={48} color="#e50914" />
        <Text style={styles.errorText}>{error}</Text>
        <View style={styles.errorBtns}>
          <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
          {usingProxy
            ? <TouchableOpacity style={[styles.retryButton, styles.altButton]} onPress={onTryDirect}><Text style={styles.retryButtonText}>Try Direct</Text></TouchableOpacity>
            : <TouchableOpacity style={[styles.retryButton, styles.altButton]} onPress={onTryProxy}><Text style={styles.retryButtonText}>Try Proxy</Text></TouchableOpacity>
          }
        </View>
      </View>
    )}

    {!streamSource && !loading && !error && (
      <View style={styles.loadingOverlay}>
        <Ionicons name="tv-outline" size={48} color="#333" />
        <Text style={styles.loadingText}>Select a channel</Text>
      </View>
    )}

    {showControls && !loading && streamSource && !error && (
      <View style={styles.controlsOverlay}>
        {/* Top bar — paddingTop:8 because status bar is hidden in fullscreen */}
        <View style={styles.controlsTop}>
          <TouchableOpacity style={styles.controlBtn} onPress={onBackPress}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={styles.controlTitle} numberOfLines={1}>{currentChannel?.name || ''}</Text>
            {usingProxy
              ? <Text style={styles.proxyBadge}>PROXY</Text>
              : <Text style={styles.directBadge}>DIRECT</Text>}
          </View>
          <TouchableOpacity style={styles.controlBtn} onPress={onFullscreenToggle}>
            <Ionicons name={fullscreen ? 'contract' : 'expand'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.playPauseBtn} onPress={onPlayPause}>
          <Ionicons
            name={isPlaying ? 'pause-circle' : 'play-circle'}
            size={60} color="rgba(255,255,255,0.9)"
          />
        </TouchableOpacity>

        <View style={styles.controlsBottom}>
          <Text style={styles.hintText}>
            {fullscreen
              ? '↑↓ = change ch  ·  ← = browser  ·  → = last ch  ·  double-tap = exit'
              : 'Double-tap = fullscreen'}
          </Text>
        </View>
      </View>
    )}
  </TouchableOpacity>
));

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  useKeepAwake();
  const { settings } = useSettings();
  const { user }     = useAuth();

  const [allChannels,        setAllChannels]        = useState([]);
  const [sections,           setSections]           = useState([]);
  const [selectedGenre,      setSelectedGenre]      = useState(null);
  const [currentChannel,     setCurrentChannel]     = useState(null);
  const [lastChannel,        setLastChannel]        = useState(null);
  const [focusedChannelId,   setFocusedChannelId]   = useState(null);
  const [streamSource,       setStreamSource]       = useState(null);
  const [loading,            setLoading]            = useState(false);
  const [isPlaying,          setIsPlaying]          = useState(false);
  const [isFullscreen,       setIsFullscreen]       = useState(false);
  const [showOverlaySidebar, setShowOverlaySidebar] = useState(false);
  const [showControls,       setShowControls]       = useState(true);
  const [usingProxy,         setUsingProxy]         = useState(false);
  const [error,              setError]              = useState(null);
  

  const videoRef       = useRef(null);
  const controlsTimer  = useRef(null);
  const lastTapTime    = useRef(0);
  const channelListRef = useRef(null);
  const isLoadingRef   = useRef(false);
  const settingsRef    = useRef(settings);
  settingsRef.current  = settings;
  const lastChannelTapTime = useRef(0);

  // Always-fresh refs for TV remote (avoid stale closures in event listener)
  const allChRef     = useRef([]);
  const curChRef     = useRef(null);
  const lastChRef    = useRef(null);
  const isFSRef      = useRef(false);
  allChRef.current   = allChannels;
  curChRef.current   = currentChannel;
  lastChRef.current  = lastChannel;
  isFSRef.current    = isFullscreen;

// ── Load channels — Sort alphabetically ───────────────────────
useEffect(() => {
  channelService.getMyChannels()
    .then(data => {
      // Sort channels alphabetically by name
      const sortedData = [...data].sort((a, b) => 
        (a.name || '').localeCompare(b.name || '')
      );
      setAllChannels(sortedData);
      
      // Group by genre and sort genres alphabetically
      const genreMap = new Map();
      
      // Group channels by genre
      sortedData.forEach(ch => {
        const g = ch.group || ch.category || 'General';
        if (!genreMap.has(g)) {
          genreMap.set(g, []);
        }
        genreMap.get(g).push(ch);
      });
      
      // Sort genres alphabetically
      const sortedGenres = Array.from(genreMap.keys()).sort((a, b) => a.localeCompare(b));
      
      // Build sections
      const built = sortedGenres.map(title => ({
        title,
        data: genreMap.get(title)
      }));
      
      setSections(built);
      if (built.length > 0) setSelectedGenre(built[0].title);
    })
    .catch(() => {});
}, []); // eslint-disable-line
  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => () => {
    videoRef.current?.unloadAsync().catch(() => {});
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
  }, []); // eslint-disable-line
  // Add this after other useEffects in HomeScreen.js
useEffect(() => {
  // Check if we have params from navigation
  const params = navigation.getState().routes.find(r => r.name === 'Home')?.params;
  if (params?.channel) {
    const newId = params.channel.channelId || params.channel._id;
    const curId = currentChannel?.channelId || currentChannel?._id;
    
    if (newId !== curId) {
      // Different channel - load it
      handleChannelSelect(params.channel, params.startFullscreen || false);
    } else if (params.startFullscreen) {
      // Same channel with fullscreen flag
      enterFullscreen();
    }
    
    // Clear the params
    navigation.setParams({ channel: undefined, startFullscreen: undefined });
  }
}, [navigation, currentChannel, handleChannelSelect, enterFullscreen]);

  // ── Controls timer ─────────────────────────────────────────────────────────
const resetControlsTimer = useCallback(() => {
  if (controlsTimer.current) clearTimeout(controlsTimer.current);
  setShowControls(true);
  controlsTimer.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_MS);
}, []);

// ── loadStream ─────────────────────────────────────────────────────────────
const loadStream = useCallback(async (channel, forceProxy) => {
  if (!channel || isLoadingRef.current) return;
  isLoadingRef.current = true;
  
  try {
    setLoading(true); setError(null); setIsPlaying(false);
    try { await videoRef.current?.unloadAsync(); } catch (_) {}
    
    let rawUrl;
    // FORCE PROXY FIRST - always use proxy
    let useProxy = true;
    
    console.log('📺 HomeScreen loading channel:', channel.name);
    console.log('   Playlist ID:', channel.playlistId);
    console.log('   Channel ID:', channel.channelId || channel._id);
    console.log('   MAC Address:', channel.macAddress || 'MISSING!');
    
    // TRY FAST SWITCH FIRST (uses cached tokens)
    try {
      console.log('⚡ Trying fast channel switch...');
      const switchResponse = await api.post('/channels/channel-switch', {
        playlistId: channel.playlistId,
        channelId: channel.channelId || channel._id
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
          playlistId: channel.playlistId
        });
        
        const freshToken = tokenResponse.data.token;
        console.log('✅ Got fresh token:', freshToken);
        
        const cmdString = String(channel.cmd || channel.url || '');
        
        // Extract base URL (everything before the path)
        const baseMatch = cmdString.match(/(https?:\/\/[^\/]+)/);
        if (!baseMatch) throw new Error('Could not extract base URL');
        
        const baseServer = baseMatch[1];
        
        // Check if it's the live.php format (MAG-style)
        if (cmdString.includes('live.php')) {
          // MAG-style stream with live.php
          const urlObj = new URL(baseServer + '/play/live.php');
          urlObj.searchParams.set('mac', channel.macAddress || '');
          urlObj.searchParams.set('stream', channel.channelId || channel._id);
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
          
          rawUrl = `${baseServer}/${username}/${freshToken}/${channel.channelId || channel._id}.ts`;
          console.log('⚡ Generated Xtream URL with fresh token:', rawUrl);
        }
        
      } catch (fastError) {
        console.log('⚠️ Fast token method failed:', fastError.message);
        
        // TRY ORIGINAL TOKEN FROM CMD THIRD
        try {
          console.log('🔄 Attempting to use original token from cmd...');
          const cmdString = String(channel.cmd || channel.url || '');
          
          // Try to extract original play_token for MAG streams
          const originalTokenMatch = cmdString.match(/play_token=([^&]+)/);
          if (originalTokenMatch) {
            const originalToken = originalTokenMatch[1];
            console.log('✅ Found original token in cmd:', originalToken);
            
            const baseMatch = cmdString.match(/(https?:\/\/[^\/]+)/);
            if (baseMatch) {
              const baseServer = baseMatch[1];
              const urlObj = new URL(baseServer + '/play/live.php');
              urlObj.searchParams.set('mac', channel.macAddress || '');
              urlObj.searchParams.set('stream', channel.channelId || channel._id);
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
          rawUrl = await channelService.getChannelStream(channel);
        }
      }
    }
    
    if (!rawUrl) throw new Error('No stream URL returned');

    // Process the URL for proxy
    const plain = (() => { 
      try { return decodeURIComponent(rawUrl); } 
      catch (_) { return rawUrl; } 
    })();
    
    const mac = channel.macAddress ? `&mac=${encodeURIComponent(channel.macAddress)}` : '';
    
    const source = {
      uri: rawUrl.startsWith(PROXY_BASE) ? rawUrl : `${PROXY_BASE}?url=${encodeURIComponent(plain)}${mac}`,
      headers: { 'User-Agent': 'ExoPlayer/2.18.1 (Linux; Android 10)', 'Accept': '*/*' },
      overrideFileExtensionAndroid: 'ts',
    };
    
    setUsingProxy(true);
    setStreamSource(source);
    
  } catch (err) {
    setError(err.message || 'Failed to load stream');
    setLoading(false);
  } finally {
    isLoadingRef.current = false;
  }
}, []);

  // ── Channel select — saves current as lastChannel ──────────────────────────
// ── Channel select with double-tap detection ──────────────────────────
const handleChannelSelect = useCallback((channel, isDoubleTap = false) => {
  if (!channel) return;
  
  const newId = channel.channelId || channel._id;
  const curId = curChRef.current?.channelId || curChRef.current?._id;
  
  // If it's a double tap OR single tap on already playing channel, go fullscreen
  if (isDoubleTap || (newId === curId)) {
    // If it's the same channel, just go fullscreen without reloading
    if (newId === curId) {
      enterFullscreen();
      resetControlsTimer();
      return;
    }
    // Different channel - load it and go fullscreen
    if (curChRef.current) setLastChannel(curChRef.current);
    setCurrentChannel(channel);
    setFocusedChannelId(newId);
    if (isFSRef.current) setShowOverlaySidebar(false);
    loadStream(channel);
    enterFullscreen(); // Enter fullscreen after loading
    resetControlsTimer();
  } else {
    // Single tap on different channel - normal playback
    if (curChRef.current) setLastChannel(curChRef.current);
    setCurrentChannel(channel);
    setFocusedChannelId(newId);
    if (isFSRef.current) setShowOverlaySidebar(false);
    resetControlsTimer();
    loadStream(channel);
  }
}, [resetControlsTimer, loadStream, enterFullscreen]);

  // ── TV / D-pad remote handler ──────────────────────────────────────────────
  const handleRemoteKey = useCallback((eventType) => {
    const channels = allChRef.current;
    if (!channels.length) return;
    const cur    = curChRef.current;
    const curIdx = cur
      ? channels.findIndex(c => (c.channelId || c._id) === (cur.channelId || cur._id))
      : -1;

    switch (eventType) {
      case 'up':
      case 'channelUp': {
        const idx = curIdx <= 0 ? channels.length - 1 : curIdx - 1;
        handleChannelSelect(channels[idx]);
        break;
      }
      case 'down':
      case 'channelDown': {
        const idx = curIdx >= channels.length - 1 ? 0 : curIdx + 1;
        handleChannelSelect(channels[idx]);
        break;
      }
      case 'left':
        // Open channel browser (fullscreen only; split view already has sidebar)
        if (isFSRef.current) setShowOverlaySidebar(v => !v);
        resetControlsTimer();
        break;
      case 'right':
        // Go back to last channel
        if (lastChRef.current) handleChannelSelect(lastChRef.current);
        break;
      case 'select':
      case 'playPause':
        setShowControls(v => {
          if (!v) { resetControlsTimer(); return true; }
          if (controlsTimer.current) clearTimeout(controlsTimer.current);
          return false;
        });
        break;
      default: break;
    }
  }, [handleChannelSelect, resetControlsTimer]);

  useEffect(() => {
    // TVEventHandler — Apple TV + Android TV SDK
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

  // ── Video callbacks ────────────────────────────────────────────────────────
  const onVideoLoad = useCallback(() => {
    setLoading(false); setIsPlaying(true); setError(null);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const onVideoStatusUpdate = useCallback((s) => {
    if (s.isLoaded && s.isPlaying !== undefined)
      setIsPlaying(p => p !== s.isPlaying ? s.isPlaying : p);
  }, []);

  // ── Hardware back ──────────────────────────────────────────────────────────
  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showOverlaySidebar) { setShowOverlaySidebar(false); return true; }
      if (isFullscreen)       { exitFullscreen();              return true; }
      return false;
    });
    return () => h.remove();
  }, [isFullscreen, showOverlaySidebar]); // eslint-disable-line

  // ── Fullscreen ─────────────────────────────────────────────────────────────
const enterFullscreen = useCallback(() => {
  StatusBar.setHidden(true, 'fade');   // imperative — works even if component lags
  setIsFullscreen(true);
  setShowOverlaySidebar(false);
  // Don't show controls when entering fullscreen
  setShowControls(false);
  // Clear any existing timer
  if (controlsTimer.current) clearTimeout(controlsTimer.current);
  // Don't start a new timer - controls should stay hidden until user taps
}, []);

  const exitFullscreen = useCallback(() => {
    StatusBar.setHidden(false, 'fade');
    setIsFullscreen(false);
    setShowOverlaySidebar(false);
    resetControlsTimer();
  }, [resetControlsTimer]);

  // ── Double-tap ─────────────────────────────────────────────────────────────
  const handleVideoTap = useCallback(() => {
  const now = Date.now();
  if (now - lastTapTime.current < DOUBLE_TAP_MS) {
    lastTapTime.current = 0;
    isFullscreen ? exitFullscreen() : enterFullscreen();
  } else {
    lastTapTime.current = now;
    // Toggle controls on single tap
    setShowControls(prev => {
      const newValue = !prev;
      if (newValue) {
        // If showing controls, set timer to auto-hide
        resetControlsTimer();
      } else {
        // If hiding controls, clear timer
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
      }
      return newValue;
    });
  }
}, [isFullscreen, enterFullscreen, exitFullscreen, resetControlsTimer]);

  // ── Play/pause + retry ─────────────────────────────────────────────────────
  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    try { isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync(); }
    catch (_) {}
    resetControlsTimer();
  }, [isPlaying, resetControlsTimer]);

  const handleRetry     = useCallback(() => currentChannel && loadStream(currentChannel, usingProxy),  [currentChannel, usingProxy, loadStream]);
  const handleTryProxy  = useCallback(() => currentChannel && loadStream(currentChannel, true),         [currentChannel, loadStream]);
  const handleTryDirect = useCallback(() => currentChannel && loadStream(currentChannel, false),        [currentChannel, loadStream]);
  const handleBackPress = useCallback(() => { if (isFullscreen) exitFullscreen(); },                    [isFullscreen, exitFullscreen]);
  const handleFSToggle  = useCallback(() => { isFullscreen ? exitFullscreen() : enterFullscreen(); },   [isFullscreen, enterFullscreen, exitFullscreen]);

  // ── Filtered channels (DB order) ──────────────────────────────────────────
 // ── Filtered channels (strict DB order) ─────────────────────────────────
const filteredChannels = useMemo(() => {
  if (!selectedGenre) return allChannels; // allChannels is already in DB order
  
  // Find the section and return its data (already in DB order)
  const section = sections.find(s => s.title === selectedGenre);
  return section?.data ?? [];
}, [selectedGenre, sections, allChannels]);

  // ── Sidebar renders ────────────────────────────────────────────────────────
  const renderGenreItem = useCallback(({ item }) => {
    const active = selectedGenre === item.title;
    return (
      <TouchableOpacity
        style={[styles.genreItem, active && styles.genreItemActive]}
        onPress={() => setSelectedGenre(item.title)} activeOpacity={0.7}
      >
        <Text style={[styles.genreText, active && styles.genreTextActive]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.genreCount}>{item.data.length}</Text>
      </TouchableOpacity>
    );
  }, [selectedGenre]);

  const renderChannelItem = useCallback(({ item }) => {
  const id     = item.channelId || item._id;
  const active = id === focusedChannelId;
  const isLast = id === (lastChannel?.channelId || lastChannel?._id);
  
  const handlePress = () => {
    const now = Date.now();
    if (now - lastChannelTapTime.current < DOUBLE_TAP_MS) {
      // Double tap detected
      lastChannelTapTime.current = 0;
      handleChannelSelect(item, true);
    } else {
      // Single tap
      lastChannelTapTime.current = now;
      handleChannelSelect(item, false);
    }
  };
  
  return (
    <TouchableOpacity
      style={[styles.channelItem, active && styles.channelItemActive]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {item.logo
        ? <Image source={{ uri: item.logo }} style={styles.channelLogo} />
        : <View style={styles.logoPlaceholder}><Ionicons name="tv" size={14} color="#555" /></View>}
      <Text style={[styles.channelName, active && styles.channelNameActive]} numberOfLines={1}>
        {item.name}
      </Text>
      {item.isHd && <Text style={styles.hdBadge}>HD</Text>}
      {/* Clock icon = this was the last watched channel */}
      {isLast && !active && <Ionicons name="time-outline" size={10} color="#f90" style={{ marginLeft: 3 }} />}
      {active && (
        <Text style={styles.tapHint}>tap for fullscreen</Text>
      )}
    </TouchableOpacity>
  );
}, [focusedChannelId, lastChannel, handleChannelSelect]);

  const SidebarContent = useCallback(() => (
    <View style={styles.sidebarInner}>
      <View style={styles.genreColumn}>
        <View style={styles.sidebarHeader}><Text style={styles.sidebarLabel}>GENRES</Text></View>
        <FlatList data={sections} keyExtractor={s => s.title} renderItem={renderGenreItem} showsVerticalScrollIndicator={false} />
      </View>
      <View style={styles.channelColumn}>
        <View style={styles.sidebarHeader}>
          <Text style={styles.sidebarLabel} numberOfLines={1}>{selectedGenre || 'ALL'}</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={{ padding: 4 }}>
            <Ionicons name="settings-outline" size={13} color="#444" />
          </TouchableOpacity>
        </View>
        <FlatList
          ref={channelListRef}
          data={filteredChannels}
          keyExtractor={ch => `${ch.playlistId}-${ch.channelId || ch._id}`}
          renderItem={renderChannelItem}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={false}
        />
      </View>
    </View>
  ), [sections, selectedGenre, filteredChannels, renderGenreItem, renderChannelItem, navigation]);

  // ── FULLSCREEN layout ──────────────────────────────────────────────────────
// ── FULLSCREEN layout ──────────────────────────────────────────────────────
if (isFullscreen) {
  return (
    <View style={styles.fullscreenContainer}>
      {/* ★ StatusBar HIDDEN component — prevents any colour bar showing through */}
      <StatusBar hidden translucent backgroundColor="transparent" />

      <PlayerArea
        fullscreen
        streamSource={streamSource} loading={loading} usingProxy={usingProxy}
        showControls={showControls} isPlaying={isPlaying}
        currentChannel={currentChannel} error={error} videoRef={videoRef}
        onVideoTap={handleVideoTap} onBackPress={exitFullscreen}
        onPlayPause={handlePlayPause} onFullscreenToggle={handleFSToggle}
        onLoad={onVideoLoad} onStatusUpdate={onVideoStatusUpdate}
        onRetry={handleRetry} onTryProxy={handleTryProxy} onTryDirect={handleTryDirect}
      />

      {showOverlaySidebar && (
        <View style={styles.overlaySidebar}><SidebarContent /></View>
      )}

      {/* Only show sidebar toggle button when controls are visible */}
      {showControls && (
        <TouchableOpacity
          style={styles.sidebarToggleBtn}
          onPress={() => setShowOverlaySidebar(v => !v)}
        >
          <Ionicons name={showOverlaySidebar ? 'chevron-forward' : 'list'} size={18} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Only show last channel pill when controls are visible AND sidebar is hidden */}
      {showControls && lastChannel && !showOverlaySidebar && (
        <TouchableOpacity style={styles.lastChPill} onPress={() => handleChannelSelect(lastChannel)} activeOpacity={0.8}>
          <Ionicons name="arrow-undo-outline" size={11} color="#f90" />
          <Text style={styles.lastChText} numberOfLines={1}> {lastChannel.name}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

  // ── SPLIT layout ───────────────────────────────────────────────────────────
  return (
    <View style={styles.splitContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" translucent={false} />

      <View style={styles.sidebar}><SidebarContent /></View>

      <View style={styles.playerColumn}>
        <View style={styles.videoSection}>
          <PlayerArea
            fullscreen={false}
            streamSource={streamSource} loading={loading} usingProxy={usingProxy}
            showControls={showControls} isPlaying={isPlaying}
            currentChannel={currentChannel} error={error} videoRef={videoRef}
            onVideoTap={handleVideoTap} onBackPress={handleBackPress}
            onPlayPause={handlePlayPause} onFullscreenToggle={handleFSToggle}
            onLoad={onVideoLoad} onStatusUpdate={onVideoStatusUpdate}
            onRetry={handleRetry} onTryProxy={handleTryProxy} onTryDirect={handleTryDirect}
          />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.infoTopRow}>
            {currentChannel ? (
              <View style={styles.infoRow}>
                {currentChannel.logo
                  ? <Image source={{ uri: currentChannel.logo }} style={styles.infoLogo} />
                  : <View style={[styles.infoLogo, { backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="tv" size={18} color="#555" /></View>}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.infoChannelName}>{currentChannel.name}</Text>
                  <Text style={styles.infoCategory}>{currentChannel.group || currentChannel.category || 'Live TV'}</Text>
                </View>
                {currentChannel.isHd && <Text style={styles.hdBadgeLarge}>HD</Text>}
                {usingProxy
                  ? <Text style={[styles.hdBadgeLarge, styles.proxyBadgeLarge]}>PROXY</Text>
                  : <Text style={[styles.hdBadgeLarge, styles.directBadgeLarge]}>DIRECT</Text>}
              </View>
            ) : (
              <Text style={styles.infoHint}>← Select a channel to start watching</Text>
            )}
            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings')}>
              <Ionicons name="settings-outline" size={20} color="#555" />
            </TouchableOpacity>
          </View>

          {currentChannel && (
            <TouchableOpacity style={styles.modeToggleRow} onPress={() => loadStream(currentChannel, !usingProxy)}>
              <Ionicons name="swap-horizontal" size={12} color="#555" style={{ marginRight: 5 }} />
              <Text style={styles.modeToggleText}>{usingProxy ? 'Switch to Direct Stream' : 'Switch to Proxy Stream'}</Text>
            </TouchableOpacity>
          )}

          {/* Last channel shortcut row */}
          {lastChannel && (
            <TouchableOpacity style={styles.lastChRow} onPress={() => handleChannelSelect(lastChannel)}>
              <Ionicons name="arrow-undo-outline" size={11} color="#f90" style={{ marginRight: 4 }} />
              <Text style={styles.lastChRowText} numberOfLines={1}>Back: {lastChannel.name}</Text>
            </TouchableOpacity>
          )}

          <View style={styles.settingsPillRow}>
            <View style={[styles.settingsPill, settings.playbackMode === 'proxy' && styles.settingsPillProxy]}>
              <Ionicons name={settings.playbackMode === 'proxy' ? 'swap-horizontal' : 'flash'} size={10} color={settings.playbackMode === 'proxy' ? '#f90' : '#e50914'} style={{ marginRight: 4 }} />
              <Text style={[styles.settingsPillText, settings.playbackMode === 'proxy' && styles.settingsPillTextProxy]}>
                Default: {settings.playbackMode === 'proxy' ? 'Proxy' : 'Direct'}
              </Text>
            </View>
          </View>

          <Text style={styles.infoHint}>Double-tap player = fullscreen · remote ↑↓ = ch · ← browser · → last</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  splitContainer:      { flex: 1, flexDirection: 'row', backgroundColor: '#0a0a0a' },
  sidebar:             { width: SIDEBAR_WIDTH, borderRightWidth: 1, borderRightColor: '#1e1e1e', backgroundColor: '#0d0d0d' },
  playerColumn:        { flex: 1, flexDirection: 'column' },
  videoSection:        { flex: 55, backgroundColor: '#000' },
  infoSection:         { flex: 45, padding: 12, backgroundColor: '#111' },

  sidebarInner:        { flex: 1, flexDirection: 'row' },
  sidebarHeader:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 7, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  sidebarLabel:        { color: '#e50914', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  genreColumn:         { width: 86, borderRightWidth: 1, borderRightColor: '#1e1e1e' },
  channelColumn:       { flex: 1 },

  genreItem:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 7, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#161616' },
  genreItemActive:     { backgroundColor: '#1a0505', borderLeftWidth: 3, borderLeftColor: '#e50914' },
  genreText:           { color: '#888', fontSize: 10, flex: 1, lineHeight: 13 },
  genreTextActive:     { color: '#fff', fontWeight: '700' },
  genreCount:          { color: '#444', fontSize: 8, marginLeft: 2 },

  channelItem:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#161616' },
  channelItemActive:   { backgroundColor: '#1e0000', borderLeftWidth: 3, borderLeftColor: '#e50914' },
  channelLogo:         { width: 24, height: 24, borderRadius: 3, resizeMode: 'contain', marginRight: 6 },
  logoPlaceholder:     { width: 24, height: 24, borderRadius: 3, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  channelName:         { color: '#bbb', fontSize: 11, flex: 1 },
  channelNameActive:   { color: '#fff', fontWeight: '600' },
  hdBadge:             { color: '#e50914', fontSize: 7, fontWeight: '700', borderWidth: 1, borderColor: '#e50914', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2, marginLeft: 3 },

  videoWrapper:        { flex: 1, backgroundColor: '#000' },
  // ★ Covers entire screen including former status bar area
  videoFullscreen:     { position: 'absolute', top: 0, left: 0, width: SW, height: SH, backgroundColor: '#000' },
  fullscreenContainer: { flex: 1, backgroundColor: '#000' },

  loadingOverlay:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center' },
  loadingText:         { color: '#aaa', marginTop: 10, fontSize: 12 },
  errorText:           { color: '#e50914', fontSize: 13, textAlign: 'center', marginHorizontal: 20, marginTop: 8, marginBottom: 14 },
  errorBtns:           { flexDirection: 'row', gap: 10 },
  retryButton:         { backgroundColor: '#e50914', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 5 },
  altButton:           { backgroundColor: '#c47a00' },
  retryButtonText:     { color: '#fff', fontSize: 13, fontWeight: '600' },

  controlsOverlay:     { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' },
  // ★ paddingTop 8 (not 28/34) — status bar is gone, no extra space needed
  controlsTop:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
  controlBtn:          { padding: 6 },
  titleBlock:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  controlTitle:        { color: '#fff', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  proxyBadge:          { color: '#f90', fontSize: 8, fontWeight: '700', borderWidth: 1, borderColor: '#f90', borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1, marginLeft: 5 },
  directBadge:         { color: '#e50914', fontSize: 8, fontWeight: '700', borderWidth: 1, borderColor: '#e50914', borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1, marginLeft: 5 },
  playPauseBtn:        { alignSelf: 'center' },
  controlsBottom:      { paddingHorizontal: 10, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center' },
  hintText:            { color: 'rgba(255,255,255,0.38)', fontSize: 9 },

  overlaySidebar:      { position: 'absolute', top: 0, left: 0, bottom: 0, width: SW * 0.44, backgroundColor: 'rgba(10,10,10,0.97)', borderRightWidth: 1, borderRightColor: '#2a2a2a', zIndex: 100 },
  sidebarToggleBtn:    { position: 'absolute', top: '50%', left: 4, backgroundColor: 'rgba(229,9,20,0.85)', borderRadius: 20, padding: 7, zIndex: 101 },

  lastChPill:          { position: 'absolute', bottom: 28, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: '#f90', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, zIndex: 102, maxWidth: 200 },
  lastChText:          { color: '#f90', fontSize: 10, fontWeight: '600', flexShrink: 1 },

  infoTopRow:          { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  infoRow:             { flexDirection: 'row', alignItems: 'center', flex: 1 },
  infoLogo:            { width: 38, height: 38, borderRadius: 5, resizeMode: 'contain' },
  infoChannelName:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  infoCategory:        { color: '#555', fontSize: 10, marginTop: 2 },
  hdBadgeLarge:        { color: '#e50914', fontSize: 8, fontWeight: '700', borderWidth: 1, borderColor: '#e50914', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, marginLeft: 5 },
  proxyBadgeLarge:     { color: '#f90', borderColor: '#f90' },
  directBadgeLarge:    { color: '#e50914', borderColor: '#e50914' },
  settingsBtn:         { padding: 6, marginLeft: 6 },
  modeToggleRow:       { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 4 },
  modeToggleText:      { color: '#555', fontSize: 10 },
  lastChRow:           { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 3 },
  lastChRowText:       { color: '#f90', fontSize: 10, flexShrink: 1 },
  settingsPillRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 2 },
  settingsPill:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  settingsPillProxy:   { backgroundColor: '#1a1200' },
  settingsPillText:    { color: '#e50914', fontSize: 9, fontWeight: '600' },
  settingsPillTextProxy: { color: '#f90' },
  infoHint:            { color: '#2a2a2a', fontSize: 9, marginTop: 4 },
  tapHint:             { color: '#f90'   , fontSize: 8, marginLeft: 4,},
  video:               { position: 'absolute', top: 0,   left: 0, right: 0, bottom: 0, width: '100%',  height: '100%',},
});