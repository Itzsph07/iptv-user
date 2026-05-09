import { Platform, StatusBar } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { IS_TV, IS_TABLET, IS_PHONE } from './constants';

// Hide system UI for immersive experience
export const hideSystemUI = async () => {
  try {
    if (Platform.OS === 'android') {
      // Full immersive mode - hides both status bar and navigation bar
      await NavigationBar.setVisibilityAsync('hidden');
      await NavigationBar.setBehaviorAsync('overlay-swipe');
      StatusBar.setHidden(true, 'none');
      
      // For TV devices, we need additional flags
      // These are handled natively in MainActivity.kt
      if (IS_TV) {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent');
      }
    }
  } catch (error) {
    console.log('Failed to hide system UI:', error);
  }
};

// Show system UI back
export const showSystemUI = async () => {
  try {
    if (Platform.OS === 'android') {
      await NavigationBar.setVisibilityAsync('visible');
      StatusBar.setHidden(false, 'fade');
    }
  } catch (error) {
    console.log('Failed to show system UI:', error);
  }
};

// Setup immersive mode for the app
export const setupImmersiveMode = async () => {
  try {
    if (Platform.OS === 'android') {
      await NavigationBar.setVisibilityAsync('hidden');
      await NavigationBar.setBehaviorAsync('overlay-swipe');
      StatusBar.setHidden(true, 'none');
      
      if (IS_TV) {
        StatusBar.setTranslucent(true);
        StatusBar.setBackgroundColor('transparent');
      }
    }
  } catch (error) {
    console.log('Failed to setup immersive mode:', error);
  }
};