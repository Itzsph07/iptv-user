// App.js (root)
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as SplashScreen from 'expo-splash-screen';
import { Platform, NativeModules, View, Text, ScrollView, StyleSheet } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider } from './src/context/AuthContext';
import { SettingsProvider } from './src/context/SettingsContext';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState({});
  const [showDebug, setShowDebug] = useState(true); // Show debug screen first

  useEffect(() => {
    async function prepare() {
      try {
        // Collect debug info
        const debug = {};
        
        // Check FFmpeg modules
        const allModules = Object.keys(NativeModules);
        debug.totalModules = allModules.length;
        
        const ffmpegModules = allModules.filter(key => 
          key.toLowerCase().includes('ffmpeg') || 
          key.toLowerCase().includes('arthenica') ||
          key.toLowerCase().includes('ffmpegkit')
        );
        debug.ffmpegModules = ffmpegModules;
        
        if (ffmpegModules.length > 0) {
          const module = NativeModules[ffmpegModules[0]];
          debug.moduleName = ffmpegModules[0];
          debug.moduleMethods = Object.keys(module);
          
          // Try to get FFmpeg version
          try {
            if (module.getFFmpegVersion) {
              debug.ffmpegVersion = await module.getFFmpegVersion();
            }
            if (module.getArch) {
              debug.arch = await module.getArch();
            }
            if (module.getPlatform) {
              debug.platform = await module.getPlatform();
            }
          } catch (e) {
            debug.methodError = e.message;
          }
        } else {
          debug.error = 'NO FFMPEG MODULE FOUND';
          debug.first10Modules = allModules.slice(0, 10);
        }
        
        debug.appIsReady = true;
        setDebugInfo(debug);
        console.log('Debug info:', JSON.stringify(debug, null, 2));
        
        // Lock to landscape
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
        
        if (Platform.OS === 'android') {
          await NavigationBar.setBackgroundColorAsync('#0a0a0a');
          await NavigationBar.setButtonStyleAsync('light');
          await NavigationBar.setVisibilityAsync('visible');
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (e) {
        console.warn(e);
        setDebugInfo({ error: e.message });
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, []);

  useEffect(() => {
    if (appIsReady) {
      SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  // Show debug screen for 5 seconds, then show app
  useEffect(() => {
    if (appIsReady) {
      const timer = setTimeout(() => {
        setShowDebug(false);
      }, 5000); // Show debug for 5 seconds
      return () => clearTimeout(timer);
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  // Debug overlay screen
  if (showDebug) {
    return (
      <SafeAreaProvider>
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>🔍 FFmpegKit Debug</Text>
          <ScrollView style={styles.debugScroll}>
            <Text style={styles.debugText}>
              {JSON.stringify(debugInfo, null, 2)}
            </Text>
          </ScrollView>
          <Text style={styles.debugHint}>App will load in 5 seconds...</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SettingsProvider>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="light" backgroundColor="#0a0a0a" hidden={false} />
          </NavigationContainer>
        </SettingsProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  debugContainer: {
    flex: 1,
    backgroundColor: '#000',
    padding: 20,
    paddingTop: 50,
  },
  debugTitle: {
    fontSize: 24,
    color: '#0f0',
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  debugScroll: {
    flex: 1,
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  debugText: {
    color: '#0f0',
    fontSize: 14,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  debugHint: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
});