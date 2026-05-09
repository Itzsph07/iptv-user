// src/components/tv/TVFocusGuide.js
import React from 'react';
import { View } from 'react-native';

// Simple pass-through component for now
export const TVFocusGuide = ({ children, style }) => {
  return <View style={style}>{children}</View>;
};