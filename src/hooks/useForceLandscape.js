// src/hooks/useForceLandscape.js
import { useEffect } from 'react';
import * as ScreenOrientation from 'expo-screen-orientation';

export const useForceLandscape = () => {
  useEffect(() => {
    const lockToLandscape = async () => {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
        console.log('📱 Screen locked to landscape');
      } catch (error) {
        console.log('Failed to lock orientation:', error);
      }
    };

    lockToLandscape();

    return () => {
      // Don't unlock when component unmounts - keep landscape
    };
  }, []);
};