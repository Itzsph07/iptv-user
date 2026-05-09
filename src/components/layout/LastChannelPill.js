// src/components/layout/LastChannelPill.js
import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

export const LastChannelPill = ({ channel, onPress }) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
      focusable={true}
    >
      <Ionicons name="arrow-undo-outline" size={11} color={COLORS.lastChannel} />
      <Text style={styles.text} numberOfLines={1}>
        {channel.name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 28,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderWidth: 1,
    borderColor: COLORS.lastChannel,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: 200,
    zIndex: 102,
  },
  text: {
    color: COLORS.lastChannel,
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
    flexShrink: 1,
  },
});