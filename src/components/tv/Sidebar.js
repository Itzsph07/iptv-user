// src/components/tv/Sidebar.js
import React, { memo } from 'react';
import { View, StyleSheet } from 'react-native';
import { GenreList } from './GenreList';
import { ChannelList } from './ChannelList';
import { COLORS } from '../../utils/constants';

export const Sidebar = memo(({
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
  viewMode,
  onBackToCategories,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {viewMode === 'categories' ? (
        <View style={styles.genreColumn}>
          <GenreList
            sections={sections}
            selectedGenre={selectedGenre}
            onGenrePress={onGenrePress}
            listRef={genreListRef}
            onSettingsPress={onSettingsPress}
          />
        </View>
      ) : (
        <View style={styles.channelColumn}>
          <ChannelList
            channels={channels}
            selectedGenre={selectedGenre}
            currentChannel={currentChannel}
            lastChannel={lastChannel}
            previewChannel={previewChannel}
            onChannelPress={onChannelPress}
            onChannelFocus={onChannelFocus}
            listRef={channelListRef}
            onSettingsPress={onSettingsPress}
            onBack={onBackToCategories}
          />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.sidebar,
    width: '100%',
  },
  genreColumn: {
    flex: 1,
    backgroundColor: COLORS.sidebar,
  },
  channelColumn: {
    flex: 1,
    backgroundColor: COLORS.sidebar,
  },
});