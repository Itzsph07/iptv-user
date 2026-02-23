// src/screens/VideoPlayerScreen.js
// SIMPLIFIED VERSION - Just plays the channel passed from navigation

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform,
  Animated, Dimensions,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';

const CONTROLS_HIDE_MS = 4000;
const DOUBLE_TAP_MS = 280;
const SCREEN = Dimensions.get('window');
const STREAM_TIMEOUT_MS = 30000;

const PROXY_BASE = (() => {
  try {
    const base = api.defaults.baseURL || 'http://192.168.100.230:5000/api';
    return base.replace(/\/api\/?$/, '') + '/api/proxy/stream';
  } catch (_) { return 'http://192.168.100.230:5000/api/proxy/stream'; }
})();

export default function VideoPlayerScreen({ route, navigation }) {
  useKeepAwake();
  const { settings } = useSettings();
  const { channel } = route.params || {};

  const [streamSource, setStreamSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [usingProxy, setUsingProxy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(true);

  const videoRef = useRef(null);
  const controlsTimer = useRef(null);
  const lastTapTime = useRef(0);
  const isLoadingRef = useRef(false);
  const loadTimeoutRef = useRef(null);

  // Slide animation
  const slideAnim = useRef(new Animated.Value(-SCREEN.width)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 80, friction: 12
    }).start();
  }, []);

  // Controls timer
  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, []);

  // Load stream on mount, release on unmount
useEffect(() => {
  if (!channel) {
    navigation.goBack();
    return;
  }

  loadStream(channel);

  return () => {
    // Stop video immediately
    if (videoRef.current) {
      videoRef.current.stopAsync().catch(() => {});
      videoRef.current.unloadAsync().catch(() => {});
    }
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    
    // Release stream token on backend so MAG portal frees the slot
    api.post('/channels/release-stream', {
      playlistId: channel.playlistId,
      channelId:  channel.channelId || channel._id,
      cmd:        channel.cmd || '',
    }).catch(() => {});
    
    console.log('🔓 VideoPlayerScreen: Released stream on unmount');
  };
}, [channel]); // eslint-disable-line

  const loadStream = useCallback(async (ch) => {
    if (!ch || isLoadingRef.current) return;
    isLoadingRef.current = true;

    try {
      setLoading(true);
      setError(null);
      setIsPlaying(false);

      if (videoRef.current) {
        try { await videoRef.current.unloadAsync(); } catch (_) {}
      }

      const isMag = ch.playlistType === 'mag' || ch.playlistType === 'stalker';
      const playlistId = ch.sourcePlaylist?.id || ch.playlistId;
      const channelId = String(ch.channelId || ch._id);

      console.log(`📺 VideoPlayer loading: ${ch.name}`);

      // Get fresh URL
      let rawUrl = null;
      try {
        const r = await api.post('/channels/get-stream-single', {
          playlistId,
          channelId,
          cmd: ch.cmd || '',
        });
        if (r.data?.url) {
          rawUrl = r.data.url;
        }
      } catch (e) {
        console.warn('⚠️ get-stream-single failed:', e.message);
      }

      if (!rawUrl && ch.streamUrl) {
        rawUrl = ch.streamUrl;
      }

      if (!rawUrl) throw new Error('No stream URL available');

      // Build proxy URI
      const plain = (() => { try { return decodeURIComponent(rawUrl); } catch (_) { return rawUrl; } })();
      const macParam = ch.macAddress ? `&mac=${encodeURIComponent(ch.macAddress)}` : '';
      const typeParam = isMag ? '&type=mag' : '&type=xtream';

      const proxyUri = rawUrl.startsWith(PROXY_BASE)
        ? rawUrl
        : `${PROXY_BASE}?url=${encodeURIComponent(plain)}${macParam}${typeParam}&channelId=${channelId}`;

      const source = {
        uri: proxyUri,
        headers: { 'User-Agent': 'ExoPlayer/2.18.1 (Linux; Android 10)', 'Accept': '*/*' },
        overrideFileExtensionAndroid: 'ts',
      };

      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = setTimeout(() => {
        setLoading(false);
        setError('Stream timeout. Please try again.');
        isLoadingRef.current = false;
      }, STREAM_TIMEOUT_MS);

      setUsingProxy(true);
      setStreamSource(source);

    } catch (err) {
      console.error('loadStream error:', err.message);
      setError(err.message || 'Failed to load stream');
      setLoading(false);
    } finally {
      isLoadingRef.current = false;
    }
  }, []);

  const onVideoLoad = useCallback(() => {
    if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
    setLoading(false);
    setIsPlaying(true);
    setError(null);
    resetControlsTimer();
  }, [resetControlsTimer]);

  const onVideoStatusUpdate = useCallback((s) => {
    if (s.isLoaded && s.isPlaying !== undefined) {
      setIsPlaying(s.isPlaying);
    }
  }, []);

  const handleVideoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTime.current < DOUBLE_TAP_MS) {
      lastTapTime.current = 0;
      setIsFullscreen(prev => !prev);
    } else {
      lastTapTime.current = now;
      setShowControls(prev => {
        if (!prev) { resetControlsTimer(); return true; }
        if (controlsTimer.current) clearTimeout(controlsTimer.current);
        return false;
      });
    }
  }, [resetControlsTimer]);

  const handlePlayPause = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (isPlaying) await videoRef.current.pauseAsync();
      else await videoRef.current.playAsync();
    } catch (_) {}
    resetControlsTimer();
  }, [isPlaying, resetControlsTimer]);

  const handleRetry = useCallback(() => {
    loadStream(channel);
  }, [channel, loadStream]);

const handleBack = useCallback(() => {
  // Force release before going back
  if (channel) {
    api.post('/channels/release-stream', {
      playlistId: channel.playlistId,
      channelId: channel.channelId || channel._id,
      cmd: channel.cmd || '',
    }).catch(() => {});
  }
  navigation.goBack();
}, [navigation, channel]);

  return (
    <Animated.View style={[styles.root, { transform: [{ translateX: slideAnim }] }]}>
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
            rate={1.0} volume={1.0} isMuted={false}
            androidImplementation="MediaPlayer"
            onLoad={onVideoLoad}
            onPlaybackStatusUpdate={onVideoStatusUpdate}
          />
        )}

        {loading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.overlayText}>Loading stream…</Text>
          </View>
        )}

        {error && !loading && (
          <View style={styles.overlay}>
            <Ionicons name="alert-circle-outline" size={42} color="#e50914" />
            <Text style={styles.errorText}>{error}</Text>
            <View style={styles.errorBtns}>
              <TouchableOpacity style={styles.btn} onPress={handleRetry}>
                <Text style={styles.btnText}>Retry</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, styles.btnAlt]} onPress={handleBack}>
                <Text style={styles.btnText}>Go Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showControls && !loading && !error && streamSource && (
          <View style={styles.controls} pointerEvents="box-none">
            <View style={styles.ctrlTop}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.channelTitle} numberOfLines={1}>{channel?.name || ''}</Text>
              <View style={styles.topRight}>
                <View style={usingProxy ? styles.badgeProxy : styles.badgeDirect}>
                  <Text style={styles.badgeText}>{usingProxy ? 'PROXY' : 'DIRECT'}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
              <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={68} color="rgba(255,255,255,0.88)" />
            </TouchableOpacity>

            <View style={styles.ctrlBottom}>
              <Text style={styles.hint}>Double-tap = exit fullscreen</Text>
            </View>
          </View>
        )}

      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute', top: 0, left: 0,
    width: SCREEN.width, height: SCREEN.height,
    backgroundColor: '#000', zIndex: 999, elevation: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center', alignItems: 'center', gap: 10,
  },
  overlayText: { color: '#888', fontSize: 13 },
  errorText: { color: '#ccc', fontSize: 12, textAlign: 'center', marginHorizontal: 30 },
  errorBtns: { flexDirection: 'row', gap: 10, marginTop: 6 },
  btn: { backgroundColor: '#e50914', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 5 },
  btnAlt: { backgroundColor: '#c47a00' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  controls: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  ctrlTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 14 : 34, paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  iconBtn: { padding: 6 },
  channelTitle: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', marginHorizontal: 8 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badgeProxy: { borderWidth: 1, borderColor: '#f90', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  badgeDirect: { borderWidth: 1, borderColor: '#e50914', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  playBtn: { alignSelf: 'center' },
  ctrlBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingBottom: Platform.OS === 'android' ? 14 : 24,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  hint: { color: 'rgba(255,255,255,0.3)', fontSize: 9 },
  video: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: SCREEN.width, height: SCREEN.height },
});