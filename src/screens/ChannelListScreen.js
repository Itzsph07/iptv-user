// screens/ChannelListScreen.js
// Channels displayed in DB order (admin-set) — no client-side re-sorting

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Image, RefreshControl,
  SafeAreaView, SectionList, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import channelService from '../services/channelService';
import { useFocusEffect } from '@react-navigation/native';

const DOUBLE_TAP_MS = 300;

export default function ChannelListScreen({ navigation }) {
  const [channels, setChannels]   = useState([]);
  const [sections, setSections]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError]         = useState(null);
  const [currentChannelId, setCurrentChannelId] = useState(null);
  const { user, logout }          = useAuth();
  
  const lastTapTime = useRef(0);
  const originalOrderRef = useRef([]); // Store original order

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

  const handleChannelPress = useCallback((channel) => {
    const channelId = channel.channelId || channel._id;
    const now = Date.now();
    
    if (now - lastTapTime.current < DOUBLE_TAP_MS) {
      lastTapTime.current = 0;
      navigation.navigate('Home', { 
        channel, 
        startFullscreen: true
      });
    } 
    else if (channelId === currentChannelId) {
      lastTapTime.current = now;
      navigation.navigate('Home', { 
        channel, 
        startFullscreen: true
      });
    } 
    else {
      lastTapTime.current = now;
      setCurrentChannelId(channelId);
      navigation.navigate('Home', { channel });
    }
  }, [navigation, currentChannelId]);

  const renderChannel = useCallback(({ item, index }) => {
    const channelId = item.channelId || item._id;
    const isActive = channelId === currentChannelId;
    
    return (
      <TouchableOpacity 
        style={[
          styles.channelItem, 
          isActive && styles.channelItemActive
        ]} 
        onPress={() => handleChannelPress(item)}
        activeOpacity={0.7}
      >
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={styles.channelLogo} />
        ) : (
          <View style={styles.placeholderLogo}>
            <Ionicons name="tv" size={22} color="#555" />
          </View>
        )}
        <View style={styles.channelInfo}>
          <Text style={[styles.channelName, isActive && styles.channelNameActive]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.isHd && (
            <View style={styles.hdBadge}>
              <Text style={styles.hdText}>HD</Text>
            </View>
          )}
        </View>
        <View style={styles.playIconContainer}>
          <Ionicons 
            name={isActive ? "tv" : "play-circle"} 
            size={isActive ? 24 : 30} 
            color={isActive ? "#f90" : "#e50914"} 
          />
          <Text style={styles.tapHint}>
            {isActive ? 'tap for fullscreen' : 'double-tap for fullscreen'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleChannelPress, currentChannelId]);

  const renderSectionHeader = useCallback(({ section: { title, data } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCount}>{data.length}</Text>
    </View>
  ), []);

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
          <TouchableOpacity onPress={logout} style={styles.logoutButton}>
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
          sections={sections}
          renderItem={renderChannel}
          renderSectionHeader={renderSectionHeader}
          keyExtractor={(item) => `${item.playlistId}-${item.channelId}-${item._originalIndex}`}
          stickySectionHeadersEnabled
          contentContainerStyle={styles.listContent}
          removeClippedSubviews={false}
          initialNumToRender={30}
          maxToRenderPerBatch={20}
          windowSize={10}
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

// ... (keep all existing styles the same)

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
  logoutButton: { padding: 8 },

  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 10,
  },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, paddingVertical: 12, color: '#fff', fontSize: 16 },

  listContent: { paddingBottom: 20 },
  sectionHeader: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 15, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitle: { color: '#e50914', fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' },
  sectionCount: { color: '#444', fontSize: 11 },

  channelItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: 12, borderBottomWidth: 1, borderBottomColor: '#141414',
    backgroundColor: '#0f0f0f',
  },
  channelItemActive: {
    backgroundColor: '#1a0505',
    borderLeftWidth: 3,
    borderLeftColor: '#f90',
  },
  channelLogo: { width: 40, height: 40, borderRadius: 5, resizeMode: 'contain' },
  placeholderLogo: {
    width: 40, height: 40, borderRadius: 5,
    backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center',
  },
  channelInfo: { flex: 1, marginLeft: 12, flexDirection: 'row', alignItems: 'center' },
  channelName: { color: '#fff', fontSize: 14, flex: 1 },
  channelNameActive: { color: '#f90', fontWeight: 'bold' },
  hdBadge: {
    backgroundColor: '#1a3a5c', paddingHorizontal: 4,
    paddingVertical: 2, borderRadius: 3, marginLeft: 8,
  },
  hdText: { color: '#4fc3f7', fontSize: 8, fontWeight: 'bold' },
  playIconContainer: { 
    alignItems: 'center',
  },
  tapHint: { 
    color: '#444', 
    fontSize: 8, 
    marginTop: 2,
  },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#999', fontSize: 16, textAlign: 'center', marginTop: 10, marginBottom: 20 },
  retryButton: { backgroundColor: '#e50914', paddingHorizontal: 30, paddingVertical: 10, borderRadius: 5 },
  retryButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  emptyText: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  emptySubtext: { color: '#444', fontSize: 14, marginTop: 10 },
});