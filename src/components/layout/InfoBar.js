// src/components/layout/InfoBar.js
import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

export const InfoBar = ({
  currentChannel,
  usingProxy,
  lastChannel,
  onLastChannelPress,
  onToggleMode,
  settings,
}) => {
  if (!currentChannel) {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="tv-outline" size={24} color={COLORS.textMuted} />
        <Text style={styles.emptyText}>Select a channel to start watching</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.mainRow}>
        <View style={styles.channelInfo}>
          {currentChannel.logo ? (
            <Image source={{ uri: currentChannel.logo }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Ionicons name="tv" size={22} color={COLORS.textSecondary} />
            </View>
          )}
          
          <View style={styles.textContainer}>
            <Text style={styles.channelName} numberOfLines={1}>
              {currentChannel.name}
            </Text>
            <Text style={styles.category} numberOfLines={1}>
              {currentChannel.group || currentChannel.category || 'Live TV'}
            </Text>
          </View>

          <View style={styles.badgeContainer}>
            {currentChannel.isHd && (
              <View style={styles.hdBadge}>
                <Text style={styles.hdText}>HD</Text>
              </View>
            )}
            
            <View style={[
              styles.modeBadge,
              usingProxy ? styles.proxyBadge : styles.directBadge
            ]}>
              <Ionicons 
                name={usingProxy ? 'swap-horizontal' : 'flash'} 
                size={10} 
                color={usingProxy ? COLORS.lastChannel : COLORS.primary} 
              />
              <Text style={[
                styles.modeText,
                usingProxy ? styles.proxyText : styles.directText
              ]}>
                {usingProxy ? 'PROXY' : 'DIRECT'}
              </Text>
            </View>
          </View>
        </View>

      </View>

      <View style={styles.footerRow}>
        {lastChannel && (
          <TouchableOpacity style={styles.lastChannelButton} onPress={onLastChannelPress}>
            <Ionicons name="arrow-undo-outline" size={14} color={COLORS.lastChannel} />
            <Text style={styles.lastChannelText} numberOfLines={1}>
              {lastChannel.name}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.toggleButton} onPress={onToggleMode}>
          <Ionicons name="repeat-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.toggleText}>
            Switch to {usingProxy ? 'Direct' : 'Proxy'}
          </Text>
        </TouchableOpacity>

        <View style={styles.defaultBadge}>
          <Ionicons
            name={settings?.playbackMode === 'proxy' ? 'shield-outline' : 'flash-outline'}
            size={12}
            color={settings?.playbackMode === 'proxy' ? COLORS.lastChannel : COLORS.primary}
          />
          <Text style={[
            styles.defaultText,
            settings?.playbackMode === 'proxy' && styles.defaultTextProxy
          ]}>
            {settings?.playbackMode === 'proxy' ? 'Proxy' : 'Direct'}
          </Text>
        </View>
      </View>

      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>
          ↑↓ Browse · ← Genres · → Last · OK Play/Pause · ↩ Back
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: COLORS.sidebar,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  emptyContainer: {
    padding: 20,
    backgroundColor: COLORS.sidebar,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginLeft: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  channelInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 8,
    resizeMode: 'contain',
    backgroundColor: COLORS.sidebarLight,
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: COLORS.sidebarLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  channelName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  category: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hdBadge: {
    backgroundColor: '#1a3a5c',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 6,
  },
  hdText: {
    color: COLORS.hd,
    fontSize: 9,
    fontWeight: 'bold',
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  proxyBadge: {
    borderColor: COLORS.lastChannel,
  },
  directBadge: {
    borderColor: COLORS.primary,
  },
  modeText: {
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 4,
  },
  proxyText: {
    color: COLORS.lastChannel,
  },
  directText: {
    color: COLORS.primary,
  },

  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  lastChannelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 168, 37, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: 'rgba(249, 168, 37, 0.3)',
  },
  lastChannelText: {
    color: COLORS.lastChannel,
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
    maxWidth: 150,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.sidebarLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 4,
  },
  toggleText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginLeft: 4,
  },
  defaultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.sidebarLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    color: COLORS.primary,
  },
  defaultTextProxy: {
    color: COLORS.lastChannel,
  },
  hintContainer: {
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  hintText: {
    color: COLORS.textMuted,
    fontSize: 10,
    textAlign: 'center',
  },
});