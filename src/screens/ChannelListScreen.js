// screens/ChannelListScreen.js
// Channels displayed in DB order (admin-set) — no client-side re-sorting
// ENHANCED with focus effects for Android TV

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, RefreshControl,
  SafeAreaView, SectionList, Alert, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import channelService from '../services/channelService';
import { useFocusEffect } from '@react-navigation/native';

const DOUBLE_TAP_MS = 300;

// Enhanced Channel Item Component with focus effects
const ChannelItem = ({ 
  item, 
  isActive, 
  onPress, 
  onFocus,
  index,
  isFirst,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const bgAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    setIsFocused(true);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1.05,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(bgAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      })
    ]).start();
    onFocus?.(item);
  };

  const handleBlur = () => {
    setIsFocused(false);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }),
      Animated.timing(bgAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      })
    ]).start();
  };

  const backgroundColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isActive ? '#1a0505' : '#0f0f0f',
      '#e50914'
    ]
  });

  const borderLeftColor = bgAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      isActive ? '#f90' : 'transparent',
      '#ffffff'
    ]
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={1}
      hasTVPreferredFocus={isFirst}
    >
      <Animated.View 
        style={[
          styles.channelItem,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor: isFocused ? backgroundColor : (isActive ? '#1a0505' : '#0f0f0f'),
            borderLeftWidth: isFocused ? 4 : (isActive ? 3 : 0),
            borderLeftColor: isFocused ? borderLeftColor : (isActive ? '#f90' : 'transparent'),
            marginVertical: isFocused ? 4 : 2,
            marginHorizontal: isFocused ? 8 : 4,
            elevation: isFocused ? 8 : 0,
            shadowColor: '#e50914',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isFocused ? 0.5 : 0,
            shadowRadius: isFocused ? 8 : 0,
            zIndex: isFocused ? 10 : 1,
          }
        ]}
      >
        <View style={styles.logoContainer}>
          {item.logo ? (
            <Image 
              source={{ uri: item.logo }} 
              style={[
                styles.channelLogo,
                isFocused && styles.channelLogoFocused
              ]} 
            />
          ) : (
            <View style={[
              styles.placeholderLogo,
              isFocused && styles.placeholderLogoFocused
            ]}>
              <Ionicons 
                name="tv" 
                size={isFocused ? 26 : 22} 
                color={isFocused ? "#fff" : "#555"} 
              />
            </View>
          )}
        </View>

        <View style={styles.channelInfo}>
          <Text 
            style={[
              styles.channelName,
              isActive && styles.channelNameActive,
              isFocused && styles.channelNameFocused
            ]} 
            numberOfLines={1}
          >
            {item.name}
          </Text>
          
          {item.isHd && (
            <View style={[
              styles.hdBadge,
              isFocused && styles.hdBadgeFocused
            ]}>
              <Text style={[
                styles.hdText,
                isFocused && styles.hdTextFocused
              ]}>HD</Text>
            </View>
          )}
        </View>

        <View style={styles.playIconContainer}>
          <Ionicons 
            name={isActive ? "tv" : "play-circle"} 
            size={isFocused ? 34 : (isActive ? 24 : 30)} 
            color={isFocused ? "#fff" : (isActive ? "#f90" : "#e50914")} 
          />
          {isFocused && (
            <Text style={styles.focusHint}>
              {isActive ? 'Press to toggle fullscreen' : 'Press to play'}
            </Text>
          )}
        </View>

        {isFocused && !isActive && (
          <Animated.View 
            style={[
              styles.focusGlow,
              {
                opacity: bgAnim,
              }
            ]} 
          />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

// Enhanced Section Header with focus effects
const SectionHeader = ({ title, count, isFocused }) => {
  return (
    <View style={[
      styles.sectionHeader,
      isFocused && styles.sectionHeaderFocused
    ]}>
      <Text style={[
        styles.sectionTitle,
        isFocused && styles.sectionTitleFocused
      ]}>{title}</Text>
      <View style={[
        styles.sectionCountContainer,
        isFocused && styles.sectionCountContainerFocused
      ]}>
        <Text style={[
          styles.sectionCount,
          isFocused && styles.sectionCountFocused
        ]}>{count}</Text>
      </View>
    </View>
  );
};

export default function ChannelListScreen({ navigation }) {
  const [channels, setChannels]   = useState([]);
  const [sections, setSections]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError]         = useState(null);
  const [currentChannelId, setCurrentChannelId] = useState(null);
  const [focusedSection, setFocusedSection] = useState(null);
  const { user, logout }          = useAuth();
  
  const lastTapTime = useRef(0);
  const sectionListRef = useRef(null);

  // ─── Group channels alphabetically ─────────────────────────────────
  const groupChannels = useCallback((list) => {
    if (!list || !list.length) {
      setSections([]);
      return;
    }

    // Sort channels alphabetically by name
    const sortedList = [...list].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '')
    );

    // Group by genre
    const genreMap = new Map();
    
    sortedList.forEach(ch => {
      const g = ch.group || 'Uncategorized';
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
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      setError(null);
      const data = await channelService.getMyChannels();
      setChannels(data);
      
      if (searchQuery.trim()) {
        // Filter by search, then sort
        const filtered = data.filter(ch => 
          ch.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        groupChannels(filtered);
      } else {
        groupChannels(data);
      }
    } catch (err) {
      console.error('Failed to load channels:', err);
      setError('Failed to load channels. Pull down to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  const handleSearch = useCallback((text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      groupChannels(channels);
      return;
    }
    
    const filtered = channels.filter(ch => 
      ch.name?.toLowerCase().includes(text.toLowerCase())
    );
    groupChannels(filtered);
  }, [channels]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const fresh = await channelService.getMyChannels();
      setChannels(fresh);
      
      if (searchQuery.trim()) {
        const filtered = fresh.filter(ch => 
          ch.name?.toLowerCase().includes(searchQuery.toLowerCase())
        );
        groupChannels(filtered);
      } else {
        groupChannels(fresh);
      }
    } catch (err) {
      Alert.alert('Refresh Failed', 'Could not refresh channels. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [searchQuery]);

  // Enhanced channel press handler
  const handleChannelPress = useCallback((channel) => {
    const now = Date.now();
    const channelId = channel.channelId || channel._id;
    
    if (now - lastTapTime.current < DOUBLE_TAP_MS) {
      lastTapTime.current = 0;
      navigation.navigate('Home', { 
        channel, 
        startFullscreen: true,
        forceReset: Date.now()
      });
    } 
    else if (channelId === currentChannelId) {
      lastTapTime.current = now;
      navigation.navigate('Home', { 
        channel, 
        startFullscreen: true,
        forceReset: Date.now()
      });
    } 
    else {
      lastTapTime.current = now;
      setCurrentChannelId(channelId);
      navigation.navigate('Home', { 
        channel,
        forceReset: Date.now()
      });
    }
  }, [navigation, currentChannelId]);

  // Load channels on mount
  useEffect(() => {
    loadChannels();
  }, []);

  const renderChannel = useCallback(({ item, index, section }) => {
    const channelId = item.channelId || item._id;
    const isActive = channelId === currentChannelId;
    const isFirstInSection = index === 0;
    
    return (
      <ChannelItem
        item={item}
        isActive={isActive}
        index={index}
        isFirst={isFirstInSection && section.title === sections[0]?.title}
        onPress={() => handleChannelPress(item)}
        onFocus={() => {
          // Optional: scroll to make focused item visible
          // You can implement scrolling logic here
        }}
      />
    );
  }, [currentChannelId, handleChannelPress, sections]);

  const renderSectionHeader = useCallback(({ section: { title, data } }) => (
    <SectionHeader 
      title={title} 
      count={data.length}
      isFocused={focusedSection === title}
    />
  ), [focusedSection]);

  const handleSectionFocus = useCallback((title) => {
    setFocusedSection(title);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.loadingText}>Loading your channels...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.username || 'User'}</Text>
          </View>
          <TouchableOpacity 
            onPress={logout} 
            style={styles.logoutButton}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search channels..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={handleSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearch('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={50} color="#e50914" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="tv-outline" size={60} color="#222" />
          <Text style={styles.emptyText}>No channels available</Text>
          <Text style={styles.emptySubtext}>Pull down to refresh</Text>
        </View>
      ) : (
        <SectionList
          ref={sectionListRef}
          sections={sections}
          renderItem={renderChannel}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => `${item.playlistId}-${item.channelId || item._id}`}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={false}
          initialNumToRender={30}
          maxToRenderPerBatch={20}
          windowSize={10}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setFocusedSection(null)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#e50914"
              colors={['#e50914']}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#999', marginTop: 10, fontSize: 16 },

  header: { backgroundColor: '#1a1a1a', padding: 15, paddingTop: 10 },
  headerTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 15,
  },
  welcomeText: { color: '#666', fontSize: 12 },
  userName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  logoutButton: { padding: 8, borderRadius: 20 },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, color: '#fff', fontSize: 16 },

  listContent: { paddingBottom: 20 },
  
  // Section Header Styles
  sectionHeader: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  sectionHeaderFocused: {
    backgroundColor: '#e50914',
    borderBottomColor: '#fff',
  },
  sectionTitle: {
    color: '#e50914',
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitleFocused: {
    color: '#fff',
  },
  sectionCountContainer: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  sectionCountContainerFocused: {
    backgroundColor: '#fff',
  },
  sectionCount: {
    color: '#999',
    fontSize: 11,
    fontWeight: '600',
  },
  sectionCountFocused: {
    color: '#e50914',
  },

  // Channel Item Styles
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  
  logoContainer: {
    marginRight: 12,
  },
  
  channelLogo: {
    width: 40,
    height: 40,
    borderRadius: 6,
    resizeMode: 'contain',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  
  channelLogoFocused: {
    width: 44,
    height: 44,
    borderColor: '#fff',
    borderWidth: 2,
  },
  
  placeholderLogo: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  
  placeholderLogoFocused: {
    width: 44,
    height: 44,
    backgroundColor: '#e50914',
    borderColor: '#fff',
  },
  
  channelInfo: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  channelName: {
    color: '#fff',
    fontSize: 15,
    flex: 1,
    fontWeight: '400',
  },
  
  channelNameActive: {
    color: '#f90',
    fontWeight: 'bold',
  },
  
  channelNameFocused: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  
  hdBadge: {
    backgroundColor: '#1a3a5c',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  
  hdBadgeFocused: {
    backgroundColor: '#fff',
    borderColor: '#e50914',
  },
  
  hdText: {
    color: '#4fc3f7',
    fontSize: 9,
    fontWeight: 'bold',
  },
  
  hdTextFocused: {
    color: '#e50914',
    fontSize: 10,
  },
  
  playIconContainer: {
    alignItems: 'center',
    marginLeft: 8,
    minWidth: 50,
  },
  
  tapHint: {
    color: '#444',
    fontSize: 8,
    marginTop: 2,
  },
  
  focusHint: {
    color: '#fff',
    fontSize: 8,
    marginTop: 2,
    textAlign: 'center',
  },
  
  focusGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(229,9,20,0.2)',
    borderRadius: 8,
    zIndex: -1,
  },

  errorContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  
  errorText: { 
    color: '#999', 
    fontSize: 16, 
    textAlign: 'center', 
    marginTop: 10, 
    marginBottom: 20 
  },
  
  retryButton: { 
    backgroundColor: '#e50914', 
    paddingHorizontal: 30, 
    paddingVertical: 12, 
    borderRadius: 8 
  },
  
  retryButtonText: { 
    color: '#fff', 
    fontSize: 16, 
    fontWeight: 'bold' 
  },

  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  
  emptyText: { 
    color: '#fff', 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginTop: 20 
  },
  
  emptySubtext: { 
    color: '#444', 
    fontSize: 14, 
    marginTop: 10 
  },
});