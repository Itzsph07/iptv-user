// src/components/tv/CategoryFirstView.js
import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GenreList } from './GenreList';
import { ChannelList } from './ChannelList';
import { COLORS } from '../../utils/constants';

export const CategoryFirstView = ({
  sections,
  selectedGenre,
  channels,
  currentChannel,
  lastChannel,
  previewChannel,
  onGenrePress,
  onChannelPress,
  onChannelFocus,
  genreListRef,
  channelListRef,
  onSettingsPress,
  onBackToCategories,
}) => {
  const [showChannels, setShowChannels] = useState(false);
  const [activeGenre, setActiveGenre] = useState(null);
  const slideAnim = useState(new Animated.Value(0))[0];

  const handleGenreSelect = (genre) => {
    setActiveGenre(genre);
    setShowChannels(true);
    onGenrePress(genre);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
    }).start();
  };

  const handleBackToCategories = () => {
    setShowChannels(false);
    setActiveGenre(null);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
    onBackToCategories?.();
  };

  if (!showChannels) {
    // Categories view only
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="grid" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.headerText}>SELECT CATEGORY</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{sections.length}</Text>
          </View>
        </View>
        <GenreList
          sections={sections}
          selectedGenre={selectedGenre}
          onGenrePress={handleGenreSelect}
          listRef={genreListRef}
        />
      </View>
    );
  }

  // Channels view (with back button)
  return (
    <View style={styles.container}>
      <View style={styles.channelHeader}>
        <Pressable
          onPress={handleBackToCategories}
          style={({ focused }) => [
            styles.backButton,
            focused && styles.backButtonFocused
          ]}
          focusable={true}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          <Text style={styles.backText}>Back to Categories</Text>
        </Pressable>
        <View style={styles.genreIndicator}>
          <Text style={styles.genreIndicatorText} numberOfLines={1}>
            {activeGenre?.length > 30 ? activeGenre.substring(0, 27) + '...' : activeGenre}
          </Text>
          <View style={styles.channelCountBadge}>
            <Text style={styles.channelCountText}>{channels.length}</Text>
          </View>
        </View>
      </View>
      <ChannelList
        channels={channels}
        selectedGenre={activeGenre}
        currentChannel={currentChannel}
        lastChannel={lastChannel}
        previewChannel={previewChannel}
        onChannelPress={onChannelPress}
        onChannelFocus={onChannelFocus}
        listRef={channelListRef}
        onSettingsPress={onSettingsPress}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.sidebar,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.sidebarLight,
  },
  headerIcon: {
    marginRight: 12,
  },
  headerText: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  countBadge: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  countText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.sidebarLight,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 8,
  },
  backButtonFocused: {
    backgroundColor: COLORS.primary,
  },
  backText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  genreIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 10,
  },
  genreIndicatorText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
    maxWidth: 200,
  },
  channelCountBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  channelCountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});