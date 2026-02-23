// src/screens/HomeScreen.js
// FIXED VERSION - Fullscreen toggles without reloading stream
// ADDED - Auto-retry and buffering detection

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Dimensions, BackHandler, FlatList, Image, StatusBar,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import channelService from '../services/channelService';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

const { width: SW, height: SH } = Dimensions.get('window');
const SIDEBAR_WIDTH = SW * 0.32;
const CONTROLS_HIDE_MS = 4000;
const DOUBLE_TAP_MS = 300;
const STREAM_TIMEOUT_MS = 8000;
const BUFFERING_TIMEOUT_MS = 5000; // 5 seconds before auto-retry
const MAX_AUTO_RETRIES = 3;

const PROXY_BASE = (() => {
  try { return api.defaults.baseURL.replace(/\/api\/?$/, '') + '/api/proxy/stream'; }
  catch (_) { return 'http://192.168.100.229:5000/api/proxy/stream'; }
})();

// ─── PlayerArea (pure display) ────────────────────────────────────────────────
const PlayerArea = React.memo(({
  fullscreen, streamSource, loading, usingProxy, buffering, retryCount,
  showControls, isPlaying, currentChannel, error,
  videoRef, onVideoTap, onBackPress, onPlayPause,
  onFullscreenToggle, onLoad, onStatusUpdate, onRetry,
  onTryProxy, onTryDirect, videoKey
}) => (
  <TouchableOpacity
    activeOpacity={1}
    style={fullscreen ? styles.videoFullscreen : styles.videoWrapper}
    onPress={onVideoTap}
  >
    {streamSource && (
      <Video
        key={videoKey}
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
        <Text style={styles.loadingText}>{usingProxy ? 'Connecting via proxy…' : 'Loading stream…'}</Text>
      </View>
    )}

    {/* Buffering indicator */}
    {buffering && !loading && (
      <View style={styles.bufferingOverlay}>
        <ActivityIndicator size="small" color="#f90" />
        <Text style={styles.bufferingText}>
          Buffering... {retryCount > 0 ? `(Retry ${retryCount}/${MAX_AUTO_RETRIES})` : ''}
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
        <View style={styles.controlsTop}>
          <TouchableOpacity style={styles.controlBtn} onPress={onBackPress}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <Text style={styles.controlTitle} numberOfLines={1}>{currentChannel?.name || ''}</Text>
            {usingProxy ? <Text style={styles.proxyBadge}>PROXY</Text> : <Text style={styles.directBadge}>DIRECT</Text>}
          </View>
          <TouchableOpacity style={styles.controlBtn} onPress={onFullscreenToggle}>
            <Ionicons name={fullscreen ? 'contract' : 'expand'} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.playPauseBtn} onPress={onPlayPause}>
          <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={60} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <View style={styles.controlsBottom}>
          <Text style={styles.hintText}>
            {fullscreen ? '↑↓ = change ch · ← = browser · → = last ch · double-tap = exit' : 'Double-tap = fullscreen'}
          </Text>
        </View>
      </View>
    )}
  </TouchableOpacity>
));

// ─── HomeScreen ───────────────────────────────────────────────────────────────
export default function HomeScreen({ navigation }) {
  useKeepAwake();
  const { settings } = useSettings();
  const { user } = useAuth();

  const [allChannels, setAllChannels] = useState([]);
  const [sections, setSections] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [currentChannel, setCurrentChannel] = useState(null);
  const [lastChannel, setLastChannel] = useState(null);
  const [focusedChannelId, setFocusedChannelId] = useState(null);
  const [streamSource, setStreamSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOverlaySidebar, setShowOverlaySidebar] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [usingProxy, setUsingProxy] = useState(false);
  const [error, setError] = useState(null);
  const [videoKey, setVideoKey] = useState(0);
  
  // New state for auto-retry
  const [buffering, setBuffering] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [stalledTimer, setStalledTimer] = useState(null);

  const videoRef = useRef(null);
  const controlsTimer = useRef(null);
  const lastTapTime = useRef(0);
  const channelListRef = useRef(null);
  const isLoadingRef = useRef(false);
  const streamTimeoutRef = useRef(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const lastChannelTapTime = useRef(0);

  const allChRef = useRef([]);
  const curChRef = useRef(null);
  const lastChRef = useRef(null);
  const isFSRef = useRef(false);
  allChRef.current = allChannels;
  curChRef.current = currentChannel;
  lastChRef.current = lastChannel;
  isFSRef.current = isFullscreen;

  // ── Load channels ──────────────────────────────────────────
  useEffect(() => {
    channelService.getMyChannels()
      .then(data => {
        const sorted = [...data].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setAllChannels(sorted);
        const genreMap = new Map();
        sorted.forEach(ch => {
          const g = ch.group || ch.category || 'General';
          if (!genreMap.has(g)) genreMap.set(g, []);
          genreMap.get(g).push(ch);
        });
        const built = Array.from(genreMap.keys()).sort().map(title => ({ title, data: genreMap.get(title) }));
        setSections(built);
        if (built.length > 0) setSelectedGenre(built[0].title);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      closeCurrentStream();
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      if (stalledTimer) clearTimeout(stalledTimer);
    };
  }, []);

  useEffect(() => {
    const unsub = navigation.addListener('blur', () => closeCurrentStream());
    return unsub;
  }, [navigation]);

  useEffect(() => {
    const params = navigation.getState().routes.find(r => r.name === 'Home')?.params;
    if (params?.channel) {
      const newId = params.channel.channelId || params.channel._id;
      const curId = currentChannel?.channelId || currentChannel?._id;
      if (newId !== curId) handleChannelSelect(params.channel, params.startFullscreen || false);
      else if (params.startFullscreen) toggleFullscreen();
      navigation.setParams({ channel: undefined, startFullscreen: undefined, forceReset: undefined });
    }
    if (params?.forceReset) {
      setVideoKey(prev => prev + 1);
    }
  }, [navigation, currentChannel]);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_MS);
  }, []);

  const closeCurrentStream = useCallback(async (channelToRelease) => {
    // Stop video locally
    if (videoRef.current) {
      try {
        await videoRef.current.stopAsync();
        await videoRef.current.unloadAsync();
        setStreamSource(null);
        setIsPlaying(false);
      } catch (_) {}
    }
    
    // Release the CORRECT channel (the one being closed, not the new one)
    const releaseChannel = channelToRelease || currentChannel;
    if (releaseChannel) {
      try {
        console.log(`🔄 Releasing stream for channel: ${releaseChannel.name}`);
        await api.post('/channels/release-stream', {
          playlistId: releaseChannel.playlistId,
          channelId: releaseChannel.channelId || releaseChannel._id,
          cmd: releaseChannel.cmd || ''
        });
      } catch (error) {
        console.log('⚠️ Release failed:', error.message);
      }
    }

    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }
  }, [currentChannel]);

  const loadStream = useCallback(async (channel, forceProxy) => {
    if (!channel) return;
    isLoadingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      setIsPlaying(false);
      setBuffering(false);
      
      if (stalledTimer) {
        clearTimeout(stalledTimer);
        setStalledTimer(null);
      }

      if (videoRef.current) {
        try { await videoRef.current.unloadAsync(); } catch (_) {}
      }

      const isMag = channel.playlistType === 'mag' || channel.playlistType === 'stalker';
      const playlistId = channel.sourcePlaylist?.id || channel.playlistId;
      const channelId = String(channel.channelId || channel._id);

      console.log(`📺 Loading: ${channel.name}`);

      let rawUrl = null;
      try {
        const r = await api.post('/channels/get-stream-single', {
          playlistId,
          channelId,
          cmd: channel.cmd || '',
        });
        
        if (r.data?.url) {
          rawUrl = r.data.url;
          console.log(`✅ Fresh URL: ${rawUrl.substring(0, 80)}`);
        }
      } catch (e) {
        console.warn('⚠️ get-stream-single failed:', e.message);
        if (e.response?.status === 458) {
          throw new Error('SESSION_BUSY: Previous session still active');
        }
      }

      if (!rawUrl && channel.streamUrl) {
        rawUrl = channel.streamUrl;
        console.warn('⚠️ Using stored streamUrl');
      }

      if (!rawUrl) throw new Error('No stream URL available');

      const plain = (() => { try { return decodeURIComponent(rawUrl); } catch (_) { return rawUrl; } })();
      const macParam = channel.macAddress ? `&mac=${encodeURIComponent(channel.macAddress)}` : '';
      const typeParam = isMag ? '&type=mag' : '&type=xtream';

      const proxyUri = rawUrl.startsWith(PROXY_BASE)
        ? rawUrl
        : `${PROXY_BASE}?url=${encodeURIComponent(plain)}${macParam}${typeParam}&channelId=${channelId}`;

      const source = {
        uri: proxyUri,
        headers: { 'User-Agent': 'ExoPlayer/2.18.1 (Linux; Android 10)', 'Accept': '*/*', 'Connection': 'close' },
        overrideFileExtensionAndroid: 'ts',
      };

      if (streamTimeoutRef.current) clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = setTimeout(() => {
        setError('Stream timeout. Tap Retry to try again.');
        setLoading(false);
        isLoadingRef.current = false;
      }, STREAM_TIMEOUT_MS);

      setUsingProxy(true);
      setVideoKey(prev => prev + 1);
      setStreamSource(source);

    } catch (err) {
      console.error('loadStream error:', err.message);
      setError(err.message || 'Failed to load stream');
      setLoading(false);
      throw err;
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  const loadStreamWithRetry = useCallback(async (channel) => {
    if (!channel || isLoadingRef.current) return;
    
    let attempts = 0;
    const maxAttempts = 3;
    
    while (attempts < maxAttempts) {
      try {
        console.log(`📺 Loading attempt ${attempts + 1}/${maxAttempts}: ${channel.name}`);
        await loadStream(channel);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!error) {
          console.log('✅ Stream loaded successfully');
          return;
        }
        
        console.log(`⚠️ Stream error detected, retry ${attempts + 1}/${maxAttempts}`);
        
      } catch (err) {
        console.warn(`⚠️ Load attempt ${attempts + 1} failed:`, err.message);
      }
      
      attempts++;
      
      if (attempts < maxAttempts) {
        const waitTime = 2000 * attempts;
        console.log(`⏱️  Waiting ${waitTime/1000}s before retry ${attempts + 1}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        
        if (channel) {
          try {
            await api.post('/channels/release-stream', {
              playlistId: channel.playlistId,
              channelId: channel.channelId || channel._id,
              cmd: channel.cmd || '',
            });
          } catch (_) {}
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }
    
    console.log('❌ All load attempts failed');
    setError('Failed to load stream after multiple attempts');
    setLoading(false);
  }, [loadStream, error]);

  // Auto-retry function
  const handleAutoRetry = useCallback(async () => {
    if (!currentChannel) return;
    
    if (retryCount < MAX_AUTO_RETRIES) {
      console.log(`🔄 Auto-retry ${retryCount + 1}/${MAX_AUTO_RETRIES}`);
      setRetryCount(prev => prev + 1);
      
      // Show buffering message
      setBuffering(true);
      
      // Stop current video
      if (videoRef.current) {
        try {
          await videoRef.current.stopAsync();
          await videoRef.current.unloadAsync();
        } catch (_) {}
      }
      
      // Small delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Reload the stream
      try {
        await loadStream(currentChannel, usingProxy);
        console.log('✅ Auto-retry successful');
      } catch (error) {
        console.log('❌ Auto-retry failed:', error.message);
        if (retryCount >= MAX_AUTO_RETRIES - 1) {
          setError('Stream unstable. Please try again manually.');
          setBuffering(false);
          setRetryCount(0);
        }
      }
    } else {
      console.log('⚠️ Max auto-retries reached, showing error');
      setError('Stream unstable. Please try again manually.');
      setBuffering(false);
      setRetryCount(0);
    }
  }, [currentChannel, usingProxy, loadStream, retryCount]);

  // ── Video callbacks ────────────────────────────────────────
  const onVideoLoad = useCallback(() => {
    if (streamTimeoutRef.current) { 
      clearTimeout(streamTimeoutRef.current); 
      streamTimeoutRef.current = null; 
    }
    setLoading(false); 
    setIsPlaying(true); 
    setError(null);
    setBuffering(false);
    setRetryCount(0); // Reset retry count on successful load
    if (stalledTimer) {
      clearTimeout(stalledTimer);
      setStalledTimer(null);
    }
    resetControlsTimer();
  }, [resetControlsTimer, stalledTimer]);

  const onVideoStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      // Update playing state
      if (status.isPlaying !== undefined) {
        setIsPlaying(status.isPlaying);
      }
      
      // DETECT BUFFERING/STALLING
      const isBuffering = !status.isPlaying && status.isBuffering;
      setBuffering(isBuffering);
      
      // If video is stalled (buffering for too long)
      if (isBuffering && !stalledTimer && !loading && currentChannel) {
        // Start a timer - if still buffering after BUFFERING_TIMEOUT_MS, retry
        const timer = setTimeout(() => {
          if (buffering && currentChannel) {
            console.log('⚠️ Stream stalled, attempting auto-retry...');
            handleAutoRetry();
          }
        }, BUFFERING_TIMEOUT_MS);
        setStalledTimer(timer);
      } else if (!isBuffering && stalledTimer) {
        // Clear timer if buffering resolved
        clearTimeout(stalledTimer);
        setStalledTimer(null);
        // Reset retry count on successful playback
        setRetryCount(0);
      }
    }
  }, [buffering, currentChannel, loading, stalledTimer, handleAutoRetry]);

  const handleChannelSelect = useCallback(async (channel, isDoubleTap = false) => {
    const newId = channel.channelId || channel._id;
    const curId = curChRef.current?.channelId || curChRef.current?._id;

    if (newId === curId) {
      // If same channel, just toggle fullscreen
      toggleFullscreen();
      return;
    }

    if (isLoadingRef.current) return;

    const oldChannel = curChRef.current;
    if (oldChannel) setLastChannel(oldChannel);

    // Reset retry state
    setRetryCount(0);
    if (stalledTimer) {
      clearTimeout(stalledTimer);
      setStalledTimer(null);
    }

    // Kill local video
    setStreamSource(null);
    setIsPlaying(false);
    setError(null);
    setLoading(true);
    setCurrentChannel(channel);
    setFocusedChannelId(newId);

    if (videoRef.current) {
      try {
        await videoRef.current.stopAsync();
        await videoRef.current.unloadAsync();
      } catch (_) {}
    }

    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current);
      streamTimeoutRef.current = null;
    }

    // Release old channel
    if (oldChannel) {
      let releaseSuccess = false;
      let releaseAttempts = 0;
      const maxAttempts = 3;
      
      while (!releaseSuccess && releaseAttempts < maxAttempts) {
        try {
          console.log(`🔓 Release attempt ${releaseAttempts + 1}/${maxAttempts} for: ${oldChannel.name}`);
          
          const response = await api.post('/channels/release-stream', {
            playlistId: oldChannel.playlistId,
            channelId:  oldChannel.channelId || oldChannel._id,
            cmd:        oldChannel.cmd || '',
          });
          
          console.log(`✅ Release response:`, response.data);
          releaseSuccess = true;
          
          const waitTime = 1000 * (releaseAttempts + 1);
          console.log(`⏱️  Waiting ${waitTime/1000}s for session to clear...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          
        } catch (e) {
          console.warn(`⚠️ Release attempt ${releaseAttempts + 1} failed:`, e.message);
          releaseAttempts++;
          
          if (releaseAttempts < maxAttempts) {
            const waitTime = 1500 * releaseAttempts;
            console.log(`⏱️  Waiting ${waitTime/1000}s before next attempt...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }

      if (!releaseSuccess && oldChannel) {
        console.log('⚠️ Release failed all attempts, trying force kill...');
        try {
          await api.post('/channels/force-kill-stream', {
            playlistId: oldChannel.playlistId,
            channelId: oldChannel.channelId || oldChannel._id,
          });
          console.log('✅ Force kill successful, waiting 3 seconds...');
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (e) {
          console.warn('Force kill failed:', e.message);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Load new channel
    await loadStreamWithRetry(channel);

    if (isDoubleTap) toggleFullscreen();
  }, [toggleFullscreen, stalledTimer]);

  // ── TV remote ─────────────────────────────────────────────
  const handleRemoteKey = useCallback((eventType) => {
    const channels = allChRef.current;
    if (!channels.length) return;
    const cur = curChRef.current;
    const curIdx = cur ? channels.findIndex(c => (c.channelId || c._id) === (cur.channelId || cur._id)) : -1;
    
    switch (eventType) {
      case 'up': case 'channelUp':
        handleChannelSelect(channels[curIdx <= 0 ? channels.length - 1 : curIdx - 1]);
        break;
      case 'down': case 'channelDown':
        handleChannelSelect(channels[curIdx >= channels.length - 1 ? 0 : curIdx + 1]);
        break;
      case 'left':
        if (isFSRef.current) setShowOverlaySidebar(v => !v);
        resetControlsTimer();
        break;
      case 'right':
        if (lastChRef.current) handleChannelSelect(lastChRef.current);
        break;
      case 'select': case 'playPause':
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

  useEffect(() => {
    const h = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showOverlaySidebar) { setShowOverlaySidebar(false); return true; }
      if (isFullscreen) { toggleFullscreen(); return true; }
      return false;
    });
    return () => h.remove();
  }, [isFullscreen, showOverlaySidebar]);

  // ─── FIXED: Toggle fullscreen without reloading stream ───
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => {
      const newValue = !prev;
      StatusBar.setHidden(newValue, 'fade');
      return newValue;
    });
    resetControlsTimer();
  }, [resetControlsTimer]);

  const handleVideoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTime.current < DOUBLE_TAP_MS) {
      lastTapTime.current = 0;
      // Double tap - toggle fullscreen WITHOUT reloading stream
      toggleFullscreen();
    } else {
      lastTapTime.current = now;
      setShowControls(prev => {
        if (!prev) { resetControlsTimer(); return true; }
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        return false;
      });
    }
  }, [toggleFullscreen, resetControlsTimer]);

  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    try { isPlaying ? await videoRef.current.pauseAsync() : await videoRef.current.playAsync(); }
    catch (_) {}
    resetControlsTimer();
  }, [isPlaying, resetControlsTimer]);

  const handleRetry = useCallback(async () => {
    if (!currentChannel) return;
    
    // Reset retry state on manual retry
    setRetryCount(0);
    if (stalledTimer) {
      clearTimeout(stalledTimer);
      setStalledTimer(null);
    }
    
    try {
      await api.post('/channels/release-stream', {
        playlistId: currentChannel.playlistId,
        channelId:  currentChannel.channelId || currentChannel._id,
        cmd:        currentChannel.cmd || '',
      });
    } catch (_) {}
    await new Promise(r => setTimeout(r, 500));
    loadStream(currentChannel, usingProxy);
  }, [currentChannel, usingProxy, loadStream, stalledTimer]);

  const handleTryProxy = useCallback(() => currentChannel && loadStream(currentChannel, true), [currentChannel, loadStream]);
  const handleTryDirect = useCallback(() => currentChannel && loadStream(currentChannel, false), [currentChannel, loadStream]);
  
  const handleBackPress = useCallback(() => {
    if (isFullscreen) toggleFullscreen();
  }, [isFullscreen, toggleFullscreen]);
  
  const handleFSToggle = useCallback(() => {
    toggleFullscreen();
  }, [toggleFullscreen]);

  const filteredChannels = useMemo(() => {
    if (!selectedGenre) return allChannels;
    return sections.find(s => s.title === selectedGenre)?.data ?? [];
  }, [selectedGenre, sections, allChannels]);

  const renderGenreItem = useCallback(({ item }) => {
    const active = selectedGenre === item.title;
    return (
      <TouchableOpacity style={[styles.genreItem, active && styles.genreItemActive]} onPress={() => setSelectedGenre(item.title)} activeOpacity={0.7}>
        <Text style={[styles.genreText, active && styles.genreTextActive]} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.genreCount}>{item.data.length}</Text>
      </TouchableOpacity>
    );
  }, [selectedGenre]);

  const renderChannelItem = useCallback(({ item }) => {
    const id = item.channelId || item._id;
    const active = id === focusedChannelId;
    const isLast = id === (lastChannel?.channelId || lastChannel?._id);
    const handlePress = () => {
      const now = Date.now();
      if (now - lastChannelTapTime.current < DOUBLE_TAP_MS) {
        lastChannelTapTime.current = 0;
        handleChannelSelect(item, true);
      } else {
        lastChannelTapTime.current = now;
        handleChannelSelect(item, false);
      }
    };
    return (
      <TouchableOpacity style={[styles.channelItem, active && styles.channelItemActive]} onPress={handlePress} activeOpacity={0.7}>
        {item.logo
          ? <Image source={{ uri: item.logo }} style={styles.channelLogo} />
          : <View style={styles.logoPlaceholder}><Ionicons name="tv" size={14} color="#555" /></View>}
        <Text style={[styles.channelName, active && styles.channelNameActive]} numberOfLines={1}>{item.name}</Text>
        {item.isHd && <Text style={styles.hdBadge}>HD</Text>}
        {isLast && !active && <Ionicons name="time-outline" size={10} color="#f90" style={{ marginLeft: 3 }} />}
        {active && <Text style={styles.tapHint}>tap for fullscreen</Text>}
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
        <FlatList ref={channelListRef} data={filteredChannels}
          keyExtractor={ch => `${ch.playlistId}-${ch.channelId || ch._id}`}
          renderItem={renderChannelItem} showsVerticalScrollIndicator={false} removeClippedSubviews={false} />
      </View>
    </View>
  ), [sections, selectedGenre, filteredChannels, renderGenreItem, renderChannelItem, navigation]);

  // Single return statement - fullscreen is handled by styles, not separate render
  return (
    <View style={isFullscreen ? styles.fullscreenContainer : styles.splitContainer}>
      <StatusBar 
        hidden={isFullscreen} 
        barStyle="light-content" 
        backgroundColor="#0a0a0a" 
        translucent={isFullscreen} 
      />
      
      {!isFullscreen && (
        <View style={styles.sidebar}>
          <SidebarContent />
        </View>
      )}
      
      <View style={!isFullscreen ? styles.playerColumn : { flex: 1 }}>
        <View style={!isFullscreen ? styles.videoSection : { flex: 1 }}>
          <PlayerArea 
            fullscreen={isFullscreen} 
            streamSource={streamSource} 
            loading={loading} 
            usingProxy={usingProxy}
            buffering={buffering}
            retryCount={retryCount}
            showControls={showControls} 
            isPlaying={isPlaying} 
            currentChannel={currentChannel}
            error={error} 
            videoRef={videoRef} 
            onVideoTap={handleVideoTap} 
            onBackPress={handleBackPress}
            onPlayPause={handlePlayPause} 
            onFullscreenToggle={handleFSToggle}
            onLoad={onVideoLoad} 
            onStatusUpdate={onVideoStatusUpdate}
            onRetry={handleRetry} 
            onTryProxy={handleTryProxy} 
            onTryDirect={handleTryDirect}
            videoKey={videoKey} 
          />
        </View>
        
        {!isFullscreen && (
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
                  {usingProxy ? <Text style={[styles.hdBadgeLarge, styles.proxyBadgeLarge]}>PROXY</Text>
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
            
            {lastChannel && (
              <TouchableOpacity style={styles.lastChRow} onPress={() => handleChannelSelect(lastChannel)}>
                <Ionicons name="arrow-undo-outline" size={11} color="#f90" style={{ marginRight: 4 }} />
                <Text style={styles.lastChRowText} numberOfLines={1}>Back: {lastChannel.name}</Text>
              </TouchableOpacity>
            )}
            
            <View style={styles.settingsPillRow}>
              <View style={[styles.settingsPill, settings.playbackMode === 'proxy' && styles.settingsPillProxy]}>
                <Ionicons name={settings.playbackMode === 'proxy' ? 'swap-horizontal' : 'flash'} size={10}
                  color={settings.playbackMode === 'proxy' ? '#f90' : '#e50914'} style={{ marginRight: 4 }} />
                <Text style={[styles.settingsPillText, settings.playbackMode === 'proxy' && styles.settingsPillTextProxy]}>
                  Default: {settings.playbackMode === 'proxy' ? 'Proxy' : 'Direct'}
                </Text>
              </View>
            </View>
            
            <Text style={styles.infoHint}>Double-tap player = fullscreen · remote ↑↓ = ch · ← browser · → last</Text>
          </View>
        )}
      </View>

      {isFullscreen && showOverlaySidebar && (
        <View style={styles.overlaySidebar}>
          <SidebarContent />
        </View>
      )}
      
      {isFullscreen && showControls && (
        <TouchableOpacity style={styles.sidebarToggleBtn} onPress={() => setShowOverlaySidebar(v => !v)}>
          <Ionicons name={showOverlaySidebar ? 'chevron-forward' : 'list'} size={18} color="#fff" />
        </TouchableOpacity>
      )}
      
      {isFullscreen && showControls && lastChannel && !showOverlaySidebar && (
        <TouchableOpacity style={styles.lastChPill} onPress={() => handleChannelSelect(lastChannel)} activeOpacity={0.8}>
          <Ionicons name="arrow-undo-outline" size={11} color="#f90" />
          <Text style={styles.lastChText} numberOfLines={1}> {lastChannel.name}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  splitContainer: { flex: 1, flexDirection: 'row', backgroundColor: '#0a0a0a' },
  sidebar: { width: SIDEBAR_WIDTH, borderRightWidth: 1, borderRightColor: '#1e1e1e', backgroundColor: '#0d0d0d' },
  playerColumn: { flex: 1, flexDirection: 'column' },
  videoSection: { flex: 55, backgroundColor: '#000' },
  infoSection: { flex: 45, padding: 12, backgroundColor: '#111' },
  sidebarInner: { flex: 1, flexDirection: 'row' },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 7, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  sidebarLabel: { color: '#e50914', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  genreColumn: { width: 86, borderRightWidth: 1, borderRightColor: '#1e1e1e' },
  channelColumn: { flex: 1 },
  genreItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 7, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#161616' },
  genreItemActive: { backgroundColor: '#1a0505', borderLeftWidth: 3, borderLeftColor: '#e50914' },
  genreText: { color: '#888', fontSize: 10, flex: 1, lineHeight: 13 },
  genreTextActive: { color: '#fff', fontWeight: '700' },
  genreCount: { color: '#444', fontSize: 8, marginLeft: 2 },
  channelItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#161616' },
  channelItemActive: { backgroundColor: '#1e0000', borderLeftWidth: 3, borderLeftColor: '#e50914' },
  channelLogo: { width: 24, height: 24, borderRadius: 3, resizeMode: 'contain', marginRight: 6 },
  logoPlaceholder: { width: 24, height: 24, borderRadius: 3, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  channelName: { color: '#bbb', fontSize: 11, flex: 1 },
  channelNameActive: { color: '#fff', fontWeight: '600' },
  hdBadge: { color: '#e50914', fontSize: 7, fontWeight: '700', borderWidth: 1, borderColor: '#e50914', paddingHorizontal: 3, paddingVertical: 1, borderRadius: 2, marginLeft: 3 },
  videoWrapper: { flex: 1, backgroundColor: '#000' },
  videoFullscreen: { position: 'absolute', top: 0, left: 0, width: SW, height: SH, backgroundColor: '#000' },
  fullscreenContainer: { flex: 1, backgroundColor: '#000' },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#aaa', marginTop: 10, fontSize: 12 },
  errorText: { color: '#e50914', fontSize: 13, textAlign: 'center', marginHorizontal: 20, marginTop: 8, marginBottom: 14 },
  errorBtns: { flexDirection: 'row', gap: 10 },
  retryButton: { backgroundColor: '#e50914', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 5 },
  altButton: { backgroundColor: '#c47a00' },
  retryButtonText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  controlsOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'space-between' },
  controlsTop: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
  controlBtn: { padding: 6 },
  titleBlock: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 6 },
  controlTitle: { color: '#fff', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  proxyBadge: { color: '#f90', fontSize: 8, fontWeight: '700', borderWidth: 1, borderColor: '#f90', borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1, marginLeft: 5 },
  directBadge: { color: '#e50914', fontSize: 8, fontWeight: '700', borderWidth: 1, borderColor: '#e50914', borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1, marginLeft: 5 },
  playPauseBtn: { alignSelf: 'center' },
  controlsBottom: { paddingHorizontal: 10, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center' },
  hintText: { color: 'rgba(255,255,255,0.38)', fontSize: 9 },
  
  // New styles for buffering indicator
  bufferingOverlay: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  bufferingText: {
    color: '#f90',
    fontSize: 12,
    marginLeft: 8,
  },
  
  overlaySidebar: { position: 'absolute', top: 0, left: 0, bottom: 0, width: SW * 0.44, backgroundColor: 'rgba(10,10,10,0.97)', borderRightWidth: 1, borderRightColor: '#2a2a2a', zIndex: 100 },
  sidebarToggleBtn: { position: 'absolute', top: '50%', left: 4, backgroundColor: 'rgba(229,9,20,0.85)', borderRadius: 20, padding: 7, zIndex: 101 },
  lastChPill: { position: 'absolute', bottom: 28, right: 12, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', borderWidth: 1, borderColor: '#f90', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5, zIndex: 102, maxWidth: 200 },
  lastChText: { color: '#f90', fontSize: 10, fontWeight: '600', flexShrink: 1 },
  infoTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  infoRow: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  infoLogo: { width: 38, height: 38, borderRadius: 5, resizeMode: 'contain' },
  infoChannelName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  infoCategory: { color: '#555', fontSize: 10, marginTop: 2 },
  hdBadgeLarge: { color: '#e50914', fontSize: 8, fontWeight: '700', borderWidth: 1, borderColor: '#e50914', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3, marginLeft: 5 },
  proxyBadgeLarge: { color: '#f90', borderColor: '#f90' },
  directBadgeLarge: { color: '#e50914', borderColor: '#e50914' },
  settingsBtn: { padding: 6, marginLeft: 6 },
  modeToggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 4 },
  modeToggleText: { color: '#555', fontSize: 10 },
  lastChRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, paddingVertical: 3 },
  lastChRowText: { color: '#f90', fontSize: 10, flexShrink: 1 },
  settingsPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6, marginBottom: 2 },
  settingsPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  settingsPillProxy: { backgroundColor: '#1a1200' },
  settingsPillText: { color: '#e50914', fontSize: 9, fontWeight: '600' },
  settingsPillTextProxy: { color: '#f90' },
  infoHint: { color: '#2a2a2a', fontSize: 9, marginTop: 4 },
  tapHint: { color: '#f90', fontSize: 8, marginLeft: 4 },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' },
});