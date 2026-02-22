// src/screens/ChannelBrowserScreen.js
// ✅ DB ORDER preserved — Map (insertion order), no .sort()
// Pure channel/genre browser — no video logic at all.

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Image, ActivityIndicator, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import channelService from '../services/channelService';

export default function ChannelBrowserScreen({
  onChannelSelect,
  currentChannelId,
  lastChannelId,      // optional — marks the last-watched channel
  navigation,
}) {
  const { user, logout } = useAuth();
  const [allChannels,   setAllChannels]   = useState([]);
  const [sections,      setSections]      = useState([]);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [loading,       setLoading]       = useState(true);

// ── Load channels — Sort alphabetically ─────────────────────────
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
    .catch(() => {})
    .finally(() => setLoading(false));
}, []); // eslint-disable-line

  const filteredChannels = useMemo(() => {
    if (!selectedGenre) return allChannels;
    return sections.find(s => s.title === selectedGenre)?.data ?? [];
  }, [selectedGenre, sections, allChannels]);

  const renderGenre = useCallback(({ item }) => {
    const active = selectedGenre === item.title;
    return (
      <TouchableOpacity
        style={[styles.genreItem, active && styles.genreActive]}
        onPress={() => setSelectedGenre(item.title)}
        activeOpacity={0.7}
      >
        <Text style={[styles.genreText, active && styles.genreTextActive]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.genreCount}>{item.data.length}</Text>
      </TouchableOpacity>
    );
  }, [selectedGenre]);

  const renderChannel = useCallback(({ item }) => {
    const id      = item.channelId || item._id;
    const active  = id === currentChannelId;
    const isLast  = id === lastChannelId && !active;
    return (
      <TouchableOpacity
        style={[styles.channelItem, active && styles.channelActive]}
        onPress={() => onChannelSelect(item)}
        activeOpacity={0.7}
      >
        {item.logo
          ? <Image source={{ uri: item.logo }} style={styles.logo} />
          : <View style={styles.logoPlaceholder}><Ionicons name="tv" size={13} color="#555" /></View>}
        <Text style={[styles.channelName, active && styles.channelNameActive]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.isHd && <Text style={styles.hd}>HD</Text>}
        {/* Clock icon = last watched */}
        {isLast && <Ionicons name="time-outline" size={10} color="#f90" style={{ marginLeft: 4 }} />}
      </TouchableOpacity>
    );
  }, [currentChannelId, lastChannelId, onChannelSelect]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#e50914" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.welcome}>Welcome,</Text>
          <Text style={styles.username}>{user?.username || 'User'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation?.navigate('Settings')}>
            <Ionicons name="settings-outline" size={18} color="#888" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={logout}>
            <Ionicons name="log-out-outline" size={18} color="#888" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Genre + Channel columns */}
      <View style={styles.columns}>
        <View style={styles.genreCol}>
          <Text style={styles.colLabel}>GENRES</Text>
          <FlatList
            data={sections}
            keyExtractor={s => s.title}
            renderItem={renderGenre}
            showsVerticalScrollIndicator={false}
          />
        </View>

        <View style={styles.channelCol}>
          <Text style={styles.colLabel} numberOfLines={1}>{selectedGenre || 'ALL'}</Text>
          <FlatList
            data={filteredChannels}
            keyExtractor={ch => `${ch.playlistId}-${ch.channelId || ch._id}`}
            renderItem={renderChannel}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:              { flex: 1, backgroundColor: '#0d0d0d' },
  center:            { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0d0d0d' },
  header:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 10, paddingTop: Platform.OS === 'android' ? 14 : 48, borderBottomWidth: 1, borderBottomColor: '#1e1e1e', backgroundColor: '#111' },
  headerLeft:        { flex: 1 },
  welcome:           { color: '#555', fontSize: 9 },
  username:          { color: '#fff', fontSize: 12, fontWeight: '700' },
  headerRight:       { flexDirection: 'row', gap: 4 },
  iconBtn:           { padding: 6 },
  columns:           { flex: 1, flexDirection: 'row' },
  genreCol:          { width: 90, borderRightWidth: 1, borderRightColor: '#1e1e1e' },
  channelCol:        { flex: 1 },
  colLabel:          { color: '#e50914', fontSize: 8, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 7, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  genreItem:         { paddingHorizontal: 7, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#161616', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  genreActive:       { backgroundColor: '#1a0505', borderLeftWidth: 2, borderLeftColor: '#e50914' },
  genreText:         { color: '#777', fontSize: 9, flex: 1, lineHeight: 12 },
  genreTextActive:   { color: '#fff', fontWeight: '700' },
  genreCount:        { color: '#333', fontSize: 8 },
  channelItem:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#161616' },
  channelActive:     { backgroundColor: '#1e0000', borderLeftWidth: 2, borderLeftColor: '#e50914' },
  logo:              { width: 22, height: 22, borderRadius: 3, resizeMode: 'contain', marginRight: 6 },
  logoPlaceholder:   { width: 22, height: 22, borderRadius: 3, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', marginRight: 6 },
  channelName:       { color: '#aaa', fontSize: 10, flex: 1 },
  channelNameActive: { color: '#fff', fontWeight: '600' },
  hd:                { color: '#e50914', fontSize: 6, fontWeight: '700', borderWidth: 1, borderColor: '#e50914', paddingHorizontal: 2, paddingVertical: 1, borderRadius: 2, marginLeft: 3 },
});