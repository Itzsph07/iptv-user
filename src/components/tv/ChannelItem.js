// src/components/tv/ChannelItem.js - Update the infoContainer and name styles
import React, { useState, useRef, useEffect, memo } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, CHANNEL_ITEM_HEIGHT } from '../../utils/constants';

export const ChannelItem = memo(({ 
  item, 
  isPlaying, 
  isLast, 
  onPress, 
  onFocus,
  index,
  isFirstInSection,
  isPreviewing,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const logoScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: (isFocused || isPreviewing) ? 1.02 : 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(logoScaleAnim, {
        toValue: (isFocused || isPreviewing) ? 1.1 : 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isFocused, isPreviewing]);

  const handleFocus = () => {
    console.log('🔴 CHANNEL FOCUSED:', item.name);
    setIsFocused(true);
    onFocus?.(item);
  };

  const handleBlur = () => {
    console.log('⚫ CHANNEL BLURRED:', item.name);
    setIsFocused(false);
  };

  // Calculate background color
  const backgroundColor = isPreviewing ? COLORS.preview :
                          isPlaying && !isFocused ? COLORS.active :
                          isFocused ? COLORS.focused :
                          COLORS.sidebar;

  const borderLeftColor = isPreviewing ? COLORS.previewBorder :
                          isPlaying && !isFocused ? COLORS.primary :
                          isFocused ? '#ffffff' :
                          'transparent';

  return (
    <Pressable
      onPress={() => onPress(item)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      hasTVPreferredFocus={isFirstInSection && index === 0}
      focusable={true}
      android_ripple={null}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <Animated.View 
        style={[
          styles.container,
          {
            transform: [{ scale: scaleAnim }],
            backgroundColor,
            borderLeftWidth: (isFocused || isPlaying || isPreviewing) ? 4 : 0,
            borderLeftColor,
            marginVertical: (isFocused || isPreviewing) ? 4 : 2,
            marginHorizontal: (isFocused || isPreviewing) ? 8 : 4,
            elevation: (isFocused || isPreviewing) ? 12 : 0,
            shadowColor: isPreviewing ? COLORS.preview : COLORS.focused,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: (isFocused || isPreviewing) ? 0.8 : 0,
            shadowRadius: (isFocused || isPreviewing) ? 12 : 0,
            zIndex: (isFocused || isPreviewing) ? 10 : 1,
          }
        ]}
      >
        {isFocused && <View style={styles.focusOutline} pointerEvents="none" />}

        <View style={styles.logoContainer}>
          <Animated.View style={{
            transform: [{ scale: logoScaleAnim }],
          }}>
            {item.logo ? (
              <Image 
                source={{ uri: item.logo }}
                style={[
                  styles.logo,
                  (isFocused || isPreviewing) && styles.logoFocused
                ]} 
              />
            ) : (
              <View style={[
                styles.placeholder,
                (isFocused || isPreviewing) && styles.placeholderFocused
              ]}>
                <Ionicons 
                  name="tv" 
                  size={(isFocused || isPreviewing) ? 28 : 24} 
                  color={(isFocused || isPreviewing) ? COLORS.text : COLORS.textSecondary} 
                />
              </View>
            )}
          </Animated.View>
          
          {isPreviewing && !isFocused && (
            <View style={styles.previewBadge}>
              <Ionicons name="arrow-up" size={10} color="#fff" />
            </View>
          )}
        </View>
        
        {/* CHANGED: infoContainer now takes full width */}
        <View style={styles.infoContainer}>
          {/* CHANGED: name takes full width, no flex limit */}
          <Text 
            style={[
              styles.name,
              isPlaying && styles.namePlaying,
              (isFocused || isPreviewing) && styles.nameFocused,
            ]} 
            numberOfLines={2} // Allow 2 lines for long names
          >
            {item.name}
          </Text>
          
          {/* Badges now wrap to next line if needed */}
          <View style={styles.badgeContainer}>
            {item.isHd && (
              <View style={[
                styles.hdBadge,
                (isFocused || isPreviewing) && styles.hdBadgeFocused
              ]}>
                <Text style={[
                  styles.hdText,
                  (isFocused || isPreviewing) && styles.hdTextFocused
                ]}>HD</Text>
              </View>
            )}
            
            {isLast && !isPlaying && (
              <View style={[
                styles.lastWatchedBadge,
                (isFocused || isPreviewing) && styles.lastWatchedBadgeFocused
              ]}>
                <Ionicons 
                  name="time-outline" 
                  size={12} 
                  color={(isFocused || isPreviewing) ? COLORS.text : COLORS.lastChannel} 
                />
                <Text style={[
                  styles.lastWatchedText,
                  (isFocused || isPreviewing) && styles.lastWatchedTextFocused
                ]}>Last</Text>
              </View>
            )}

            {isPlaying && (
              <View style={[
                styles.playingIndicator,
                (isFocused || isPreviewing) && styles.playingIndicatorFocused
              ]}>
                <Ionicons name="play" size={12} color="#fff" />
                <Text style={styles.playingText}>NOW</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    minHeight: CHANNEL_ITEM_HEIGHT,
    borderRadius: 6,
    width: '100%',
    position: 'relative',
  },
  focusOutline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 6,
    zIndex: 20,
  },
  logoContainer: {
    marginRight: 12,
    width: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
    borderRadius: 6,
    resizeMode: 'contain',
    backgroundColor: COLORS.sidebarLight,
  },
  logoFocused: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: COLORS.text,
  },
  placeholder: {
    width: 40,
    height: 40,
    borderRadius: 6,
    backgroundColor: COLORS.sidebarLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderFocused: {
    width: 44,
    height: 44,
    backgroundColor: COLORS.focused,
  },
  // CHANGED: infoContainer now takes remaining space
  infoContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  // CHANGED: name takes available space, can wrap to 2 lines
  name: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    flexWrap: 'wrap',
  },
  namePlaying: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  nameFocused: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 4,
  },
  hdBadge: {
    backgroundColor: '#1a3a5c',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hdBadgeFocused: {
    backgroundColor: '#ffffff',
  },
  hdText: {
    color: COLORS.hd,
    fontSize: 9,
    fontWeight: 'bold',
  },
  hdTextFocused: {
    color: COLORS.primary,
  },
  lastWatchedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(249, 168, 37, 0.15)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lastWatchedBadgeFocused: {
    backgroundColor: COLORS.lastChannel,
  },
  lastWatchedText: {
    color: COLORS.lastChannel,
    fontSize: 9,
    fontWeight: '600',
    marginLeft: 2,
  },
  lastWatchedTextFocused: {
    color: '#ffffff',
  },
  playingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
  },
  playingIndicatorFocused: {
    backgroundColor: '#ffffff',
  },
  playingText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '700',
    marginLeft: 2,
  },
  previewBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: COLORS.preview,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
});