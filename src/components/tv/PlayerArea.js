// src/components/tv/PlayerArea.js
import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  PanResponder, Platform, Animated,
} from 'react-native';
import Video from 'react-native-video';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils';
import { TVFocusGuide } from './TVFocusGuide';

export const PlayerArea = ({
  fullscreen,
  streamSource,
  loading,
  usingProxy,
  error,
  showControls,
  currentChannel,
  videoRef,
  onVideoTap,
  onLoad,
  onStatusUpdate,
  onRetry,
  videoKey,
  hasTVPreferredFocus,
  onSwipeRight,
  useSoftwareDecoder,
  videoFormat, audioFormat,
  setVideoFormat, setAudioFormat,
  availableVideoFormats, availableAudioFormats,
}) => {
  const [errorDismissed, setErrorDismissed] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false);
  const controlsAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (error) setErrorDismissed(false);
  }, [error]);

  useEffect(() => {
    setIsActuallyPlaying(false);
    setErrorDismissed(false);
  }, [videoKey]);

  useEffect(() => {
    Animated.timing(controlsAnim, {
      toValue: showControls ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showControls]);

  const panResponder = useMemo(() => {
    if (Platform.isTV) return null;
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        fullscreen && Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 20,
      onPanResponderRelease: (_, g) => {
        if (g.dx > 100 && g.vx > 0.5) onSwipeRight?.();
      },
    });
  }, [fullscreen, onSwipeRight]);

  const fixAudio = useCallback(async () => {
    console.log('Fix audio pressed');
  }, []);

  const showErrorBanner = !!error && !errorDismissed && !loading;

  return (
    <TVFocusGuide
      autoFocus={hasTVPreferredFocus}
      style={fullscreen ? s.fullscreen : s.wrapper}
    >
      <View style={StyleSheet.absoluteFill} {...(panResponder?.panHandlers || {})}>

        {/* ── VIDEO ─────────────────────────────────────────────────────── */}
        {streamSource ? (
          <Video
  key={videoKey}
  ref={videoRef}
  style={s.video}
  source={streamSource}
  resizeMode="stretch"
  paused={false}
  muted={false}
  volume={1.0}
  repeat={false}
  controls={false}
  hideShutterView={true}
  disableFocus={true}
  addTagUrl="" 
 // useTextureView={!!useSoftwareDecoder}
 // useSoftwareDecoder={useSoftwareDecoder}
  //decoderPriority={useSoftwareDecoder ? "SOFTWARE" : "HARDWARE"}
  bufferConfig={{
    minBufferMs: 15000,
    maxBufferMs: 50000,
    bufferForPlaybackMs: 2500,
    bufferForPlaybackAfterRebufferMs: 5000,
  }}
  onLoad={() => {
    console.log('✅ Video loaded');
    setIsActuallyPlaying(true);
    if (onLoad) onLoad({ isLoaded: true });
  }}
  onProgress={(data) => {
    if (onStatusUpdate) {
      onStatusUpdate({
        isLoaded: true,
        isPlaying: !data.seekableDuration === false,
        positionMillis: data.currentTime * 1000,
        durationMillis: data.seekableDuration * 1000,
      });
    }
  }}
  onError={(videoError) => {
    console.log('❌ Video error:', videoError);
    const errorMessage = videoError.error?.localizedDescription || 'Playback failed';
    if (onStatusUpdate) {
      onStatusUpdate({ error: errorMessage, isLoaded: false });
    }
  }}
  onEnd={() => {
    console.log('Video ended');
    setIsActuallyPlaying(false);
  }}
/>
        ) : (
          <View style={s.idle}>
            <View style={s.idleIconWrap}>
              <Ionicons name="tv-outline" size={44} color="rgba(255,255,255,0.1)" />
            </View>
            <Text style={s.idleText}>Select a channel</Text>
          </View>
        )}

        {/* ── TOUCH LAYER ───────────────────────────────────────────────── */}
        <TouchableOpacity
          activeOpacity={1}
          style={StyleSheet.absoluteFill}
          onPress={onVideoTap}
          hasTVPreferredFocus={hasTVPreferredFocus}
          focusable
        >

          {/* LOADING OVERLAY */}
          {loading && (
            <View style={s.loadingOverlay}>
              <View style={s.loadingCard}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={s.loadingTitle}>
                  {usingProxy ? 'Connecting via proxy…' : 'Loading…'}
                </Text>
                <Text style={s.loadingChannel} numberOfLines={1}>
                  {currentChannel?.name || ''}
                </Text>
              </View>
            </View>
          )}

          {/* ERROR BANNER */}
          {showErrorBanner && (
            <View style={s.errorBanner}>
              <View style={s.errorBannerLeft}>
                <Ionicons name="warning-outline" size={16} color="#fbbf24" />
                <View style={{ flex: 1 }}>
                  <Text style={s.errorBannerTitle}>Playback Error</Text>
                  <Text style={s.errorBannerBody} numberOfLines={1}>{error}</Text>
                </View>
              </View>
              <View style={s.errorBannerActions}>
                <TouchableOpacity
                  style={s.errorBannerBtn}
                  onPress={onRetry}
                  focusable
                >
                  <Ionicons name="refresh" size={13} color="rgba(255,255,255,0.7)" />
                  <Text style={s.errorBannerBtnText}>Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.errorBannerDismiss}
                  onPress={() => setErrorDismissed(true)}
                  focusable
                >
                  <Ionicons name="close" size={14} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ✨ REMOVED: The entire controls section (topBar and bottomBar) ✨ */}
          {/* No more showControls overlay with LIVE dot or bottom controls */}

        </TouchableOpacity>
      </View>
    </TVFocusGuide>
  );
};

// ─── STYLES (cleaned up - removed unused control styles) ─────────────────────────────────────────────────
const s = StyleSheet.create({
  wrapper:    { flex: 1, backgroundColor: '#000' },
  fullscreen: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },
  video:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' },

  idle: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center', gap: 14,
  },
  idleIconWrap: {
    width: 78, height: 78, borderRadius: 39,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
  idleText: { color: 'rgba(255,255,255,0.18)', fontSize: 13, fontWeight: '500' },

  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center',
  },
  loadingCard: {
    alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(12,12,18,0.97)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20, paddingHorizontal: 44, paddingVertical: 34, minWidth: 250,
  },
  loadingTitle:   { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '500' },
  loadingChannel: { color: 'rgba(255,255,255,0.25)', fontSize: 12, maxWidth: 220, textAlign: 'center' },

  errorBanner: {
    position: 'absolute',
    top: Platform.isTV ? 70 : 56,
    left: 12, right: 12,
    backgroundColor: 'rgba(10,8,4,0.95)',
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)',
    borderRadius: 12, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    zIndex: 200,
  },
  errorBannerLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorBannerTitle: { color: '#fbbf24', fontSize: 12, fontWeight: '700' },
  errorBannerBody:  { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 1 },
  errorBannerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorBannerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7,
  },
  errorBannerBtnText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '600' },
  errorBannerDismiss: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center', alignItems: 'center',
  },
});
