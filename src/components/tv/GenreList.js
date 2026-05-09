// src/components/tv/GenreList.js
import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GenreItem } from './GenreItem';
import { COLORS } from '../../utils/constants';

export const GenreList = memo(({ 
  sections, 
  selectedGenre, 
  onGenrePress,
  listRef,
  onSettingsPress,
}) => {
  const [settingsFocused, setSettingsFocused] = useState(false);
  
  const renderGenreItem = ({ item, index }) => {
    const isActive = selectedGenre === item.title;
    
    return (
      <GenreItem
        item={item}
        isActive={isActive}
        onPress={onGenrePress}
        index={index}
        isFirstInSection={index === 0}
      />
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>📺 GENRES</Text>
        <View style={styles.headerRight}>
          <Text style={styles.countText}>{sections.length}</Text>
          
          {/* Settings button in header */}
          <Pressable
            onPress={onSettingsPress}
            onFocus={() => setSettingsFocused(true)}
            onBlur={() => setSettingsFocused(false)}
            focusable={true}
            style={styles.settingsButton}
          >
            <View style={[styles.settingsIcon, settingsFocused && styles.settingsIconFocused]}>
              {settingsFocused && <View style={styles.focusOutline} pointerEvents="none" />}
              <Ionicons
                name="settings-outline"
                size={18}
                color={settingsFocused ? '#ffffff' : '#999'}
              />
            </View>
          </Pressable>
        </View>
      </View>
      <FlatList
        ref={listRef}
        data={sections}
        keyExtractor={item => item.title}
        renderItem={renderGenreItem}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
    backgroundColor: '#1a1a1a',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerText: {
    color: '#e50914',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  countText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  settingsButton: {
    padding: 2,
  },
  settingsIcon: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIconFocused: {
    backgroundColor: '#e50914',
  },
  focusOutline: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 18,
    zIndex: 20,
  },
});