// src/screens/VideoPlayerScreen.js
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, StatusBar, Platform,
  Animated, Dimensions,
} from 'react-native';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import api from '../services/api';
import { useSettings } from '../context/SettingsContext';
import { IS_TV, IS_TABLET } from '../utils/constants';
import { hideSystemUI, showSystemUI } from '../utils/fullscreenHelper';

const CONTROLS_HIDE_MS = 4000;
const DOUBLE_TAP_MS = 280;
const { width, height } = Dimensions.get('window');
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
  const insets = useSafeAreaInsets();

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

  // Lock to landscape on mount
useEffect(() => {
  const setup = async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      
      // Hide status bar for fullscreen video
      StatusBar.setHidden(true);
      
      // Hide system UI for phones (not TV)
      if (!IS_TV) {
        await hideSystemUI();
      }
    } catch (error) {
      console.log('Failed to setup video player:', error);
    }
  };
  setup();
  
  return () => {
    // Restore system UI when exiting
    if (!IS_TV) {
      showSystemUI();
    }
  };
}, []);

  // Slide animation
  const slideAnim = useRef(new Animated.Value(-width)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 80, friction: 12
    }).start();
  }, []);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    setShowControls(true);
    controlsTimer.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_MS);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, []);

  useEffect(() => {
    if (!channel) {
      navigation.goBack();
      return;
    }

    loadStream(channel);

    return () => {
      if (videoRef.current) {
        videoRef.current.stopAsync().catch(() => {});
        videoRef.current.unloadAsync().catch(() => {});
      }
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      
      api.post('/channels/release-stream', {
        playlistId: channel.playlistId,
        channelId: channel.channelId || channel._id,
        cmd: channel.cmd || '',
      }).catch(() => {});
    };
  }, [channel]);

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

      const plain = (() => { try { return decodeURIComponent(rawUrl); } catch (_) { return rawUrl; } })();
      const macParam = ch.macAddress ? `&mac=${encodeURIComponent(ch.macAddress)}` : '';
      const typeParam = isMag ? '&type=mag' : '&type=xtream';

      const proxyUri = rawUrl.startsWith(PROXY_BASE)
        ? rawUrl
        : `${PROXY_BASE}?url=${encodeURIComponent(plain)}${macParam}${typeParam}&channelId=${channelId}&force_sw=1`;

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
            resizeMode="contain"
            shouldPlay
            isLooping={false}
            useNativeControls={false}
            rate={1.0}
            volume={1.0}
            isMuted={false}
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
            <View style={[styles.ctrlTop, { paddingTop: insets.top || (Platform.OS === 'android' ? 14 : 34) }]}>
              <TouchableOpacity style={styles.iconBtn} onPress={handleBack}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.channelTitle} numberOfLines={1}>{channel?.name || ''}</Text>
              <View style={styles.topRight}>
                <View style={usingProxy ? styles.badgeProxy : styles.badgeDirect}>
                  <Text style={styles.badgeText}>{usingProxy ? 'PROXY' : 'DIRECT'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.ctrlCenter}>
              <TouchableOpacity style={styles.playBtn} onPress={handlePlayPause}>
                <Ionicons name={isPlaying ? 'pause-circle' : 'play-circle'} size={80} color="rgba(255,255,255,0.9)" />
              </TouchableOpacity>
            </View>

            <View style={[styles.ctrlBottom, { paddingBottom: insets.bottom || (Platform.OS === 'android' ? 14 : 24) }]}>
              <Text style={styles.hint}>Double-tap to exit • Tap for controls</Text>
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
    width: width, height: height,
    backgroundColor: '#000', zIndex: 999, elevation: 999,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  overlayText: { color: '#888', fontSize: 14, fontWeight: '500' },
  errorText: { color: '#ccc', fontSize: 14, textAlign: 'center', marginHorizontal: 30, lineHeight: 20 },
  errorBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { backgroundColor: '#e50914', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  btnAlt: { backgroundColor: '#c47a00' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  controls: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  ctrlTop: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingBottom: 12, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  ctrlCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtn: { padding: 8 },
  channelTitle: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '600', marginHorizontal: 12 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badgeProxy: { borderWidth: 1, borderColor: '#f90', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  badgeDirect: { borderWidth: 1, borderColor: '#e50914', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  playBtn: { 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    borderRadius: 50, 
    padding: 8,
  },
  ctrlBottom: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  hint: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },
video: { 
  position: 'absolute', 
  top: 0, left: 0, right: 0, bottom: 0, 
  width: '100%', 
  height: '100%' 
},
});