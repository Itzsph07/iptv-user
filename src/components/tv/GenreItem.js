// src/components/tv/GenreItem.js
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { COLORS, GENRE_ITEM_HEIGHT, FONT_SIZES, IS_TV } from '../../utils/constants';

export const GenreItem = ({ 
  item, 
  isActive, 
  onPress, 
  index,
  isFirstInSection 
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isFocused ? 1.02 : 1,
      friction: 4,
      tension: 50,
      useNativeDriver: true,
    }).start();
  }, [isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  // Truncate long genre names properly
  const displayTitle = item.title.length > 25 ? item.title.substring(0, 22) + '...' : item.title;

  return (
    <Pressable
      onPress={() => onPress(item.title)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      hasTVPreferredFocus={isFirstInSection && index === 0}
      focusable={true}
      android_ripple={null}
      style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1 }]}
    >
      <Animated.View style={[
        styles.container,
        isActive && styles.activeContainer,
        isFocused && styles.focusedContainer,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        {isFocused && <View style={styles.focusOutline} pointerEvents="none" />}
        
        <View style={styles.contentRow}>
          <View style={[styles.indicator, isActive && styles.activeIndicator]} />
          <Text 
            style={[
              styles.text,
              isActive && styles.activeText,
              isFocused && styles.focusedText
            ]} 
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
          <View style={[
            styles.badge,
            isActive && styles.activeBadge,
            isFocused && styles.focusedBadge
          ]}>
            <Text style={[
              styles.count,
              isActive && styles.activeCount,
              isFocused && styles.focusedCount
            ]}>
              {item.data.length}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 6,
    marginVertical: 2,
    borderRadius: 8,
    backgroundColor: '#131313',
  },
  activeContainer: {
    backgroundColor: '#2a0a0a',
  },
  focusedContainer: {
    backgroundColor: COLORS.focused,
    transform: [{ scale: 1.02 }],
  },
  focusOutline: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: 2,
    borderColor: '#ffffff',
    borderRadius: 8,
    zIndex: 20,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  indicator: {
    width: 3,
    height: 20,
    borderRadius: 2,
    backgroundColor: 'transparent',
    marginRight: 8,
  },
  activeIndicator: {
    backgroundColor: COLORS.primary,
  },
  text: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.genreName,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  activeText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  focusedText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: FONT_SIZES.genreNameFocused,
  },
  badge: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    minWidth: 32,
    alignItems: 'center',
    marginLeft: 8,
  },
  activeBadge: {
    backgroundColor: COLORS.primary,
  },
  focusedBadge: {
    backgroundColor: '#ffffff',
  },
  count: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  activeCount: {
    color: '#ffffff',
  },
  focusedCount: {
    color: COLORS.primary,
  },
});