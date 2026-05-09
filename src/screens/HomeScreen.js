// src/screens/HomeScreen.js
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, StatusBar, BackHandler, Animated, TouchableOpacity, 
  InteractionManager, Dimensions, Platform, Text, Alert
} from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useChannelData, useStreamPlayer, useFullscreen, useTVRemote, useSidebarAnimation, useGenreSelection } from '../hooks';
import { PlayerArea, Sidebar } from '../components/tv';
import { InfoBar, LastChannelPill } from '../components/layout';
import { scrollToIndex } from '../utils/layoutHelpers';
import { getChannelId, getNextChannel, getPreviousChannel } from '../utils/channelHelpers';
import { COLORS, CHANNEL_ITEM_HEIGHT, GENRE_ITEM_HEIGHT } from '../utils/constants';
import api from '../services/api';
import { IS_TV, IS_TABLET, IS_PHONE } from '../utils/constants';
import { useAuth } from '../context/AuthContext';

const { width, height } = Dimensions.get('window');
const isTV = Platform.isTV || width >= 1280;
const isTablet = width >= 768 && width < 1280;

// Dynamic sidebar width
const SIDEBAR_WIDTH = (() => {
  if (isTV) return 380;
  if (isTablet) return 320;
  return 280;
})();

const PROXY_BASE = (() => {
  try { return api.defaults.baseURL.replace(/\/api\/?$/, '') + '/api/proxy/stream'; }
  catch (_) { return 'http://192.168.100.229:5000/api/proxy/stream'; }
})();

export default function HomeScreen({ navigation }) {
  useKeepAwake();
  const insets = useSafeAreaInsets();

  const {
    sections, currentChannel, lastChannel,
    filteredChannels, selectChannel,
  } = useChannelData();

  const { selectedGenre, handleGenrePress } = useGenreSelection(sections);
 
  const { 
  user, 
  isAuthenticated, 
  logoutIfExpired, 
  checkSubscriptionStatus 
} = useAuth();

  const {
    videoRef,
    streamSource,
    loading,
    isPlaying,
    usingProxy,
    error,
    videoKey,
    loadStream,
    releaseStream,
    onLoad,
    onStatusUpdate,
    prefetchStream,
    videoFormat, audioFormat, container,
    setVideoFormat, setAudioFormat, setContainer,
    availableVideoFormats, availableAudioFormats, availableContainers,
    useSoftwareDecoder, toggleSoftwareDecoder,
  } = useStreamPlayer();

  const {
    isFullscreen, showControls, focusPanel,
    setFocusPanel, toggleFullscreen, showControlsTemporarily,
  } = useFullscreen(false);

  const [showSidebar, setShowSidebar] = useState(false);
  const [previewChannel, setPreviewChannel] = useState(null);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [sidebarView, setSidebarView] = useState('categories'); // 'categories' or 'channels'
  const { sidebarTransform, overlayOpacity } = useSidebarAnimation(showSidebar);

  const lastTapTime = useRef(0);
  const normalChannelListRef = useRef(null);
  const overlayChannelListRef = useRef(null);
  const normalGenreListRef = useRef(null);
  const overlayGenreListRef = useRef(null);
  const preloadTimeoutRef = useRef(null);
  const previewTimeoutRef = useRef(null);
  const isLoadingRef = useRef(false);

  const currentChannels = useMemo(() => {
    if (!selectedGenre || !sections.length) return filteredChannels;
    const section = sections.find(s => s.title === selectedGenre);
    return section?.data || [];
  }, [selectedGenre, sections, filteredChannels]);

  const handleLoadStream = useCallback(async (channel) => {
    if (!channel || isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      await loadStream(channel);
    } catch (err) {
      console.error('[HomeScreen] loadStream error:', err.message);
    } finally {
      isLoadingRef.current = false;
    }
  }, [loadStream]);

  const handleChannelSelect = useCallback(async (channel, startFullscreen = false) => {
    if (!channel) return;
    setHasInteracted(true);

    if (currentChannel && getChannelId(channel) === getChannelId(currentChannel)) {
      toggleFullscreen();
      return;
    }

    console.log('🔄 Selecting channel:', channel.name);
    if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
    if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);

    const previousChannel = currentChannel;
    selectChannel(channel);
    setPreviewChannel(null);
    handleLoadStream(channel).catch(console.log);
    if (previousChannel) releaseStream(previousChannel).catch(() => {});
    if (startFullscreen) toggleFullscreen();
  }, [currentChannel, selectChannel, handleLoadStream, releaseStream, toggleFullscreen]);

  const handlePreviewUp = useCallback(() => {
    if (!currentChannel || !currentChannels.length || showSidebar) return;
    const prev = getPreviousChannel(currentChannels, getChannelId(currentChannel));
    if (prev) {
      setPreviewChannel(prev);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = setTimeout(() => setPreviewChannel(null), 2000);
    }
  }, [currentChannel, currentChannels, showSidebar]);

  const handlePreviewDown = useCallback(() => {
    if (!currentChannel || !currentChannels.length || showSidebar) return;
    const next = getNextChannel(currentChannels, getChannelId(currentChannel));
    if (next) {
      setPreviewChannel(next);
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = setTimeout(() => setPreviewChannel(null), 2000);
    }
  }, [currentChannel, currentChannels, showSidebar]);

  const preloadChannel = useCallback((channel) => {
    if (!channel) return;
    if (currentChannel && getChannelId(channel) === getChannelId(currentChannel)) return;
    if (preloadTimeoutRef.current) clearTimeout(preloadTimeoutRef.current);
    preloadTimeoutRef.current = setTimeout(() => {
      prefetchStream(channel).catch(() => {});
    }, 300);
  }, [currentChannel, prefetchStream]);

  // Scroll to active channel
  const scrollToActiveChannel = useCallback(() => {
    if (!currentChannel || !currentChannels.length) return;
    const idx = currentChannels.findIndex(ch => getChannelId(ch) === getChannelId(currentChannel));
    if (idx >= 0) {
      InteractionManager.runAfterInteractions(() => {
        scrollToIndex(normalChannelListRef, idx, CHANNEL_ITEM_HEIGHT);
        scrollToIndex(overlayChannelListRef, idx, CHANNEL_ITEM_HEIGHT);
      });
    }
  }, [currentChannel, currentChannels]);

  // Scroll to active genre
  const scrollToActiveGenre = useCallback(() => {
    if (!selectedGenre || !sections.length) return;
    const idx = sections.findIndex(s => s.title === selectedGenre);
    if (idx >= 0) {
      InteractionManager.runAfterInteractions(() => {
        scrollToIndex(normalGenreListRef, idx, GENRE_ITEM_HEIGHT || 64);
        scrollToIndex(overlayGenreListRef, idx, GENRE_ITEM_HEIGHT || 64);
      });
    }
  }, [selectedGenre, sections]);

  // Handle exit with confirmation dialog
  const handleExitApp = useCallback(() => {
    if (Platform.OS === 'android') {
      Alert.alert(
        'Exit App',
        'Are you sure you want to exit?',
        [
          {
            text: 'No',
            style: 'cancel',
          },
          {
            text: 'Yes',
            onPress: () => BackHandler.exitApp(),
          },
        ],
        { cancelable: true }
      );
    }
  }, []);

  // Handle back navigation step by step
  const handleBackNavigation = useCallback(() => {
    // Step 1: If sidebar is open in fullscreen, close it
    if (isFullscreen && showSidebar) {
      setShowSidebar(false);
      setFocusPanel('player');
      return true;
    }
    
    // Step 2: If in fullscreen, exit fullscreen and show current channel
    if (isFullscreen) {
      toggleFullscreen();
      // After exiting fullscreen, scroll to current channel
      setTimeout(() => scrollToActiveChannel(), 300);
      return true;
    }
    
    // Step 3: If preview channel is showing, clear it
    if (previewChannel) {
      setPreviewChannel(null);
      return true;
    }
    
    // Step 4: If in channel list view, go back to categories with active genre selected
    if (sidebarView === 'channels') {
      setSidebarView('categories');
      // Scroll to active genre
      setTimeout(() => scrollToActiveGenre(), 300);
      return true;
    }
    
    // Step 5: If in categories view (split mode), show exit dialog
    if (!isFullscreen) {
      handleExitApp();
      return true;
    }
    
    return true;
  }, [isFullscreen, showSidebar, previewChannel, sidebarView, toggleFullscreen, setFocusPanel, handleExitApp, scrollToActiveChannel, scrollToActiveGenre]);

  // Update handleGenrePress to navigate to channel list and scroll to active channel
  const handleGenrePressWithNavigation = useCallback((genreTitle) => {
    handleGenrePress(genreTitle);
    setSidebarView('channels');
    // After navigating to channel list, scroll to current channel if it's in this genre
    setTimeout(() => {
      if (currentChannel && currentChannels.length > 0) {
        const channelInGenre = currentChannels.find(ch => 
          getChannelId(ch) === getChannelId(currentChannel)
        );
        if (channelInGenre) {
          scrollToActiveChannel();
        }
      }
    }, 300);
  }, [handleGenrePress, currentChannel, currentChannels, scrollToActiveChannel]);

  const renderSidebarContent = useCallback((listRefs, genreListRef, isOverlay = false) => (
    <Sidebar
      sections={sections}
      selectedGenre={selectedGenre}
      channels={currentChannels}
      currentChannel={currentChannel}
      lastChannel={lastChannel}
      previewChannel={previewChannel}
      onGenrePress={handleGenrePressWithNavigation}
      onChannelPress={handleChannelSelect}
      onChannelFocus={preloadChannel}
      genreListRef={genreListRef}
      channelListRef={listRefs}
      onSettingsPress={() => navigation.navigate('Settings')}
      viewMode={sidebarView}
      onBackToCategories={() => {
        setSidebarView('categories');
        setTimeout(() => scrollToActiveGenre(), 300);
      }}
    />
  ), [sections, selectedGenre, currentChannels, currentChannel, lastChannel, previewChannel,
      handleGenrePressWithNavigation, handleChannelSelect, navigation, preloadChannel, sidebarView, scrollToActiveGenre]);

  const handleSwipeRight = useCallback(() => {
    if (isFullscreen && !showSidebar) {
      setShowSidebar(true);
      setFocusPanel('sidebar');
      showControlsTemporarily();
    }
  }, [isFullscreen, showSidebar, setFocusPanel, showControlsTemporarily]);

  useTVRemote({
    left: () => { 
      setShowSidebar(true); 
      setFocusPanel('sidebar'); 
      showControlsTemporarily(); 
    },
    right: () => {
      if (!showSidebar && lastChannel) {
        handleChannelSelect(lastChannel);
        setPreviewChannel(null);
      } else if (showSidebar) { 
        setShowSidebar(false); 
        setFocusPanel('player'); 
      }
    },
    up: () => { handlePreviewUp(); },
    down: () => { handlePreviewDown(); },
    select: () => {
      if (previewChannel) {
        handleChannelSelect(previewChannel);
        setPreviewChannel(null);
      } else {
        showControlsTemporarily();
      }
    },
    playPause: () => showControlsTemporarily(),
    back: () => {
      handleBackNavigation();
    },
    channelUp: () => { handlePreviewUp(); },
    channelDown: () => { handlePreviewDown(); },
  });

  // Handle hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      return handleBackNavigation();
    });
    return () => handler.remove();
  }, [handleBackNavigation]);

  useEffect(() => {
    if (!currentChannel || !currentChannels.length) return;
    scrollToActiveChannel();
  }, [currentChannel, currentChannels, scrollToActiveChannel]);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
    };
  }, []);
  // Force fullscreen on TV devices
useEffect(() => {
  if (Platform.OS === 'android') {
    // This runs on every render but the native side handles it
    try {
      const NavigationBar = require('expo-navigation-bar');
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    } catch (e) {
      console.log('NavigationBar not available');
    }
  }
}, []);

  const handleVideoTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      lastTapTime.current = 0;
      toggleFullscreen();
    } else {
      lastTapTime.current = now;
      showControlsTemporarily();
    }
  }, [toggleFullscreen, showControlsTemporarily]);

// Add this to HomeScreen.js - Subscription expiry checker
useEffect(() => {
  // Check subscription status when app starts
  const checkSubscription = async () => {
    if (user && isAuthenticated) {
      const loggedOut = await logoutIfExpired();
      if (!loggedOut) {
        await checkSubscriptionStatus(true);
      }
    }
  };
  
  checkSubscription();
  
  // Set up interval to check every 24 hours
  const interval = setInterval(async () => {
    if (user && isAuthenticated) {
      const loggedOut = await logoutIfExpired();
      if (!loggedOut) {
        await checkSubscriptionStatus(true);
      }
    }
  }, 24 * 60 * 60 * 1000);
  
  return () => clearInterval(interval);
}, [user, isAuthenticated]);

  return (
    <View style={[isFullscreen ? styles.fullscreen : styles.split, IS_TV && { paddingTop: insets.top }]}>
      <StatusBar hidden={isFullscreen} translucent backgroundColor="transparent" barStyle="light-content" />

      {!isFullscreen && (
        <View style={[styles.sidebar, { width: SIDEBAR_WIDTH }]}>
          {renderSidebarContent(normalChannelListRef, normalGenreListRef, false)}
        </View>
      )}

      <View style={!isFullscreen ? styles.playerColumn : { flex: 1 }}>
        <PlayerArea
          fullscreen={isFullscreen}
          streamSource={streamSource}
          loading={loading}
          usingProxy={usingProxy}
          error={error}
          showControls={showControls}
          currentChannel={currentChannel}
          previewChannel={previewChannel}
          videoRef={videoRef}
          onVideoTap={handleVideoTap}
          onLoad={onLoad}
          onStatusUpdate={onStatusUpdate}
          onRetry={() => currentChannel && handleLoadStream(currentChannel)}
          videoKey={videoKey}
          hasTVPreferredFocus={focusPanel === 'player'}
          onSwipeRight={handleSwipeRight}
          useSoftwareDecoder={useSoftwareDecoder}
          toggleSoftwareDecoder={toggleSoftwareDecoder}
          videoFormat={videoFormat}
          audioFormat={audioFormat}
          container={container}
          setVideoFormat={setVideoFormat}
          setAudioFormat={setAudioFormat}
          setContainer={setContainer}
          availableVideoFormats={availableVideoFormats}
          availableAudioFormats={availableAudioFormats}
          availableContainers={availableContainers}
        />

        {!isFullscreen && (
          <InfoBar
            currentChannel={currentChannel}
            usingProxy={usingProxy}
            lastChannel={lastChannel}
            onLastChannelPress={() => lastChannel && handleChannelSelect(lastChannel)}
            onToggleMode={() => currentChannel && handleLoadStream(currentChannel)}
            settings={{ playbackMode: 'direct' }}
          />
        )}
      </View>

      {isFullscreen && showSidebar && (
        <>
          <Animated.View style={[
            styles.overlayBackground,
            { opacity: overlayOpacity },
          ]}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              onPress={() => setShowSidebar(false)}
              activeOpacity={1}
            />
          </Animated.View>

          <Animated.View style={[styles.overlaySidebar, sidebarTransform, { width: SIDEBAR_WIDTH }]}>
            {renderSidebarContent(overlayChannelListRef, overlayGenreListRef, true)}
          </Animated.View>
        </>
      )}

      {isFullscreen && showControls && lastChannel && !showSidebar && hasInteracted && (
        <LastChannelPill
          channel={lastChannel}
          onPress={() => handleChannelSelect(lastChannel)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  split: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: COLORS.background || '#0a0a0a',
  },
  fullscreen: { 
    flex: 1, 
    backgroundColor: '#000',
  },
  sidebar: { 
    borderRightWidth: 1, 
    borderRightColor: COLORS.border || '#2a2a2a', 
    backgroundColor: COLORS.sidebar || '#111111',
  },
  playerColumn: { 
    flex: 1,
  },
  overlayBackground: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000', zIndex: 99,
  },
  overlaySidebar: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    backgroundColor: COLORS.sidebar || '#111111',
    borderRightWidth: 1, borderRightColor: COLORS.border || '#2a2a2a',
    zIndex: 100, elevation: 10,
    shadowColor: '#000', shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 8,
  },
});