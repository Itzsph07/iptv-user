// src/components/tv/ChannelList.js
import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ChannelItem } from './ChannelItem';
import { COLORS, CHANNEL_ITEM_HEIGHT, FONT_SIZES } from '../../utils/constants';

export const ChannelList = memo(({ 
  channels,
  selectedGenre,
  currentChannel,
  lastChannel,
  previewChannel,
  onChannelPress,
  onChannelFocus,
  listRef,
  onSettingsPress,
  onBack,
  hasTVPreferredFocus,
}) => {
  const [settingsFocused, setSettingsFocused] = useState(false);
  const [backFocused, setBackFocused] = useState(false);

  const renderChannelItem = ({ item, index }) => {
    const isPlaying = currentChannel ? 
      (item.channelId || item._id) === (currentChannel.channelId || currentChannel._id) : false;
    const isLast = lastChannel ? 
      (item.channelId || item._id) === (lastChannel.channelId || lastChannel._id) : false;
    const isPreviewing = previewChannel ? 
      (item.channelId || item._id) === (previewChannel.channelId || previewChannel._id) : false;
    
    return (
      <ChannelItem
        item={item}
        isPlaying={isPlaying}
        isLast={isLast}
        isPreviewing={isPreviewing}
        index={index}
        isFirstInSection={index === 0 && hasTVPreferredFocus}
        onPress={onChannelPress}
        onFocus={onChannelFocus}
      />
    );
  };

  const getItemLayout = (_, index) => ({
    length: CHANNEL_ITEM_HEIGHT,
    offset: CHANNEL_ITEM_HEIGHT * index,
    index,
  });

  const headerTitle = selectedGenre || 'ALL CHANNELS';

  const handleBackPress = () => {
    if (onBack) {
      onBack();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {/* Back button on the LEFT */}
        <Pressable
          onPress={handleBackPress}
          onFocus={() => setBackFocused(true)}
          onBlur={() => setBackFocused(false)}
          focusable={true}
          style={styles.backButton}
        >
          <View style={[styles.backIcon, backFocused && styles.backIconFocused]}>
            {backFocused && <View style={styles.focusOutline} pointerEvents="none" />}
            <Ionicons
              name="arrow-back"
              size={20}
              color={backFocused ? '#ffffff' : COLORS.primary}
            />
          </View>
        </Pressable>
        
        {/* Title and count */}
        <View style={styles.headerCenter}>
          <Text style={styles.headerText} numberOfLines={1}>
            {headerTitle}
          </Text>
          <Text style={styles.countText}>{channels.length}</Text>
        </View>
        
        {/* Settings button on the RIGHT */}
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
              size={20}
              color={settingsFocused ? '#ffffff' : '#999'}
            />
          </View>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        data={channels}
        keyExtractor={ch => `${ch.playlistId}-${ch.channelId || ch._id}`}
        renderItem={renderChannelItem}
        showsVerticalScrollIndicator={false}
        getItemLayout={getItemLayout}
        removeClippedSubviews={true}
        maxToRenderPerBatch={20}
        windowSize={10}
        initialNumToRender={20}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    width: '100%',
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
  backButton: {
    marginRight: 8,
  },
  backIcon: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  backIconFocused: {
    backgroundColor: COLORS.primary,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    color: '#e50914',
    fontSize: FONT_SIZES?.channelHeader || 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 8,
    textAlign: 'center',
  },
  countText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#1e1e1e',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  settingsButton: {
    marginLeft: 8,
  },
  settingsIcon: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 36,
    minHeight: 36,
  },
  settingsIconFocused: {
    backgroundColor: COLORS.primary,
  },
  focusOutline: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 10,
    zIndex: 20,
  },
});