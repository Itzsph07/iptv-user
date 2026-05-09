// src/navigation/AppNavigator.js
import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet, Platform } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useAuth } from '../context/AuthContext';
import LoginScreen    from '../screens/LoginScreen';
import HomeScreen     from '../screens/HomeScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { setupImmersiveMode, showSystemUI } from '../utils/fullscreenHelper';
import { IS_TV } from '../utils/constants';

const Stack = createNativeStackNavigator();

function LoadingScreen() {
  return (
    <View style={styles.loading}>
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  // Force landscape and immersive mode when navigator mounts
  useEffect(() => {
    const setupApp = async () => {
      try {
        // Lock to landscape
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
        
        // Setup immersive mode for phones/tablets (not TV)
        if (!IS_TV) {
          await setupImmersiveMode();
        }
      } catch (error) {
        console.log('Failed to setup app:', error);
      }
    };
    
    setupApp();
    
    // Show system UI when app closes/unmounts
    return () => {
      if (!IS_TV) {
        showSystemUI();
      }
    };
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Stack.Screen name="Login" component={LoginScreen} />
      ) : (
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ animation: 'slide_from_right' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loading:     { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', fontSize: 16 },
});