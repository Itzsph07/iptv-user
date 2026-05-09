// src/utils/layoutHelpers.js
import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export const getResponsiveSize = (size, baseWidth = 375) => {
  return (width / baseWidth) * size;
};

export const isLandscape = () => {
  return width > height;
};

export const getSidebarWidth = () => {
  return width * 0.35;
};

export const getVideoHeight = (fullscreen) => {
  return fullscreen ? height : height * 0.55;
};

export const getItemLayout = (itemHeight) => (data, index) => ({
  length: itemHeight,
  offset: itemHeight * index,
  index,
});

export const scrollToIndex = (listRef, index, itemHeight, animated = false) => {
  if (!listRef?.current) return;
  
  try {
    listRef.current.scrollToIndex({ 
      index, 
      animated, 
      viewPosition: 0.3 
    });
  } catch (error) {
    listRef.current.scrollToOffset({ 
      offset: index * itemHeight, 
      animated 
    });
  }
};