// src/hooks/useTVRemote.js
import { useEffect } from 'react';
import { Platform, BackHandler } from 'react-native';

export const useTVRemote = (handlers = {}) => {
  useEffect(() => {
    // Check if we're in Expo Go
    const isExpoGo = typeof Expo !== 'undefined' || 
                     global.__expo || 
                     global.expo?.modules?.ExpoGo;
    
    console.log('📺 Environment:', {
      isTV: Platform.isTV,
      isExpoGo: isExpoGo,
      platform: Platform.OS,
    });

    // For Android TV, we need to use BackHandler for back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('🔙 Hardware back pressed');
      if (handlers.back) {
        handlers.back();
        return true; // Prevent default
      }
      return false;
    });

    // For TV remote events, we need to use the native TV event handler
    if (Platform.isTV) {
      try {
        // Try to get TVEventHandler from react-native
        const { TVEventHandler } = require('react-native');
        
        if (TVEventHandler) {
          console.log('✅ TVEventHandler loaded successfully');
          const tvEventHandler = new TVEventHandler();
          
          tvEventHandler.enable(null, (comp, event) => {
            if (!event) return;
            
            const { eventType, eventKeyAction } = event;
            console.log('🎯 TV Event:', { eventType, eventKeyAction });
            
            // Map event types to handlers
            switch (eventType) {
              case 'up':
              case 19:
                console.log('⬆️ Up pressed');
                handlers.up?.();
                handlers.channelUp?.();
                break;
              case 'down':
              case 20:
                console.log('⬇️ Down pressed');
                handlers.down?.();
                handlers.channelDown?.();
                break;
              case 'left':
              case 21:
                console.log('⬅️ Left pressed');
                handlers.left?.();
                break;
              case 'right':
              case 22:
                console.log('➡️ Right pressed');
                handlers.right?.();
                break;
              case 'select':
              case 23:
                console.log('✅ Select pressed');
                handlers.select?.();
                break;
              case 'playPause':
              case 85:
                console.log('⏯️ Play/Pause pressed');
                handlers.playPause?.();
                break;
              case 'channelUp':
              case 166:
                console.log('📺 Channel Up pressed');
                handlers.channelUp?.();
                break;
              case 'channelDown':
              case 167:
                console.log('📺 Channel Down pressed');
                handlers.channelDown?.();
                break;
              default:
                // Try to call handler by event type name
                if (handlers[eventType]) {
                  handlers[eventType]();
                }
                break;
            }
          });

          return () => {
            console.log('🧹 Cleaning up TVEventHandler');
            tvEventHandler.disable();
            backHandler.remove();
          };
        }
      } catch (error) {
        console.log('❌ TVEventHandler not available:', error.message);
      }
    } else {
      // For non-TV platforms (development), log but don't add window listeners
      console.log('📱 Not a TV platform - remote handlers disabled');
    }

    // Clean up back handler on unmount
    return () => backHandler.remove();
  }, [handlers]);

  return { isReady: false };
};