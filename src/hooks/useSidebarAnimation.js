// src/hooks/useSidebarAnimation.js
import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import { SIDEBAR_WIDTH } from '../utils/constants';

export const useSidebarAnimation = (isVisible, duration = 300) => {
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_WIDTH * 1.3)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.5,
          duration,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -SIDEBAR_WIDTH * 1.3,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, duration, slideAnim, opacityAnim]);

  return {
    sidebarTransform: { transform: [{ translateX: slideAnim }] },
    overlayOpacity: opacityAnim,
  };
};