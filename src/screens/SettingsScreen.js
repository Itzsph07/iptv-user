// screens/SettingsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
  StatusBar,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';
import * as ScreenOrientation from 'expo-screen-orientation';

// Helper functions for expiry date
const getExpiryDate = (user) => {
  return user?.customer?.expiryDate || user?.expiryDate || null;
};

const formatExpiryDate = (user) => {
  const dateString = getExpiryDate(user);
  if (!dateString) return 'Not set';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return dateString;
  }
};

const getDaysRemaining = (user) => {
  const dateString = getExpiryDate(user);
  if (!dateString) return null;
  try {
    const expiry = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch {
    return null;
  }
};

const isExpired = (user) => {
  const dateString = getExpiryDate(user);
  if (!dateString) return false;
  try {
    const expiry = new Date(dateString);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return expiry < today;
  } catch {
    return false;
  }
};

// Reusable focusable row wrapper
function FocusableRow({ onPress, style, children }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      focusable={true}
      android_ripple={null}
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[style, focused && styles.focusedRow]}>
        {focused && <View style={styles.focusOutline} pointerEvents="none" />}
        {children}
      </View>
    </Pressable>
  );
}

export default function SettingsScreen({ navigation }) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { user, logout } = useAuth();

  // Force landscape on mount
  useEffect(() => {
    const lockToLandscape = async () => {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } catch (error) {
        console.log('Failed to lock orientation:', error);
      }
    };
    lockToLandscape();
  }, []);

  // Intercept hardware back on Settings screen
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      console.log('⬅️ Settings: going back to Home');
      navigation.goBack();
      return true;
    });
    return () => handler.remove();
  }, [navigation]);

  const isDirectMode = settings.playbackMode === 'direct';
  const isProxyMode = settings.playbackMode === 'proxy';
  
  const daysRemaining = getDaysRemaining(user);
  const expired = isExpired(user);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={styles.header}>
        <FocusableRow
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </FocusableRow>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── ACCOUNT & SUBSCRIPTION ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons name="person-circle-outline" size={18} color="#888" style={{ marginRight: 8 }} />
            <Text style={styles.statusLabel}>Logged in as</Text>
            <Text style={styles.statusValue}>{user?.username || user?.customer?.name || user?.name || '—'}</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.statusRow}>
            <Ionicons name="calendar-outline" size={18} color="#888" style={{ marginRight: 8 }} />
            <Text style={styles.statusLabel}>Subscription expires</Text>
            <Text style={[styles.statusValue, { color: expired ? '#f44336' : '#4caf50' }]}>
              {formatExpiryDate(user)}
            </Text>
          </View>
          
          {!expired && daysRemaining !== null && daysRemaining > 0 && (
            <>
              <View style={styles.statusRow}>
                <Ionicons name="time-outline" size={18} color="#888" style={{ marginRight: 8 }} />
                <Text style={styles.statusLabel}>Days remaining</Text>
                <Text style={[styles.statusValue, { color: daysRemaining <= 7 ? '#ff9800' : '#4caf50' }]}>
                  {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
                </Text>
              </View>
              
              {/* Warning banner for low days */}
              {daysRemaining <= 10 && daysRemaining > 0 && (
                <View style={[styles.statusRow, styles.warningRow]}>
                  <Ionicons name="warning" size={18} color="#ff9800" style={{ marginRight: 8 }} />
                  <Text style={styles.warningText}>
                    ⚠️ Your subscription expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}!
                  </Text>
                </View>
              )}
            </>
          )}
          
          {expired && (
            <View style={[styles.statusRow, styles.expiredRow]}>
              <Ionicons name="close-circle" size={18} color="#f44336" style={{ marginRight: 8 }} />
              <Text style={styles.expiredText}>
                ❌ SUBSCRIPTION EXPIRED - Please contact support
              </Text>
            </View>
          )}
        </View>

        {/* ── DECODER SETTINGS ─────────────────────────────────── */}
        <Text style={styles.sectionTitle}>DECODER</Text>
        <View style={styles.card}>
          <FocusableRow
            onPress={() => updateSetting('forceSoftwareDecoder', !settings.forceSoftwareDecoder)}
            style={styles.toggleRow}
          >
            <View style={styles.toggleLeft}>
              <Ionicons
                name={settings.forceSoftwareDecoder ? 'code-slash' : 'hardware-chip'}
                size={20}
                color={settings.forceSoftwareDecoder ? '#818cf8' : '#22c55e'}
                style={{ marginRight: 12 }}
              />
              <View>
                <Text style={styles.toggleTitle}>
                  {settings.forceSoftwareDecoder ? 'Software Decoder' : 'Hardware Decoder'}
                </Text>
                <Text style={styles.toggleDesc}>
                  {settings.forceSoftwareDecoder
                    ? 'Software (MediaPlayer) · CPU · Works on all devices'
                    : 'Hardware (ExoPlayer) · GPU · Faster, may crash on some devices'}
                </Text>
              </View>
            </View>
            <View style={[styles.toggle, settings.forceSoftwareDecoder && styles.toggleOn]}>
              <View style={[styles.toggleThumb, settings.forceSoftwareDecoder && styles.toggleThumbOn]} />
            </View>
          </FocusableRow>

          <View style={styles.divider} />

          <View style={styles.statusRow}>
            <Ionicons name="information-circle-outline" size={18} color="#888" style={{ marginRight: 8 }} />
            <Text style={styles.statusLabel}>Current decoder</Text>
            <Text style={[styles.statusValue, { color: settings.forceSoftwareDecoder ? '#818cf8' : '#22c55e' }]}>
              {settings.forceSoftwareDecoder ? 'Software (MediaPlayer)' : 'Hardware (ExoPlayer)'}
            </Text>
          </View>
        </View>

        {/* ── Playback Mode ────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>PLAYBACK MODE</Text>
        <View style={styles.card}>
          <Text style={styles.cardDesc}>
            Choose how channels are streamed. Direct is faster when your network
            allows it. Proxy routes the stream through your server, which helps
            with channels that block direct access.
          </Text>

          {/* Direct option */}
          <FocusableRow
            onPress={() => updateSetting('playbackMode', 'direct')}
            style={[styles.modeOption, isDirectMode && styles.modeOptionActive]}
          >
            <View style={styles.modeLeft}>
              <View style={[styles.modeIcon, isDirectMode && styles.modeIconActive]}>
                <Ionicons name="flash" size={20} color={isDirectMode ? '#fff' : '#555'} />
              </View>
              <View style={styles.modeText}>
                <Text style={[styles.modeTitle, isDirectMode && styles.modeTitleActive]}>
                  Direct Stream
                </Text>
                <Text style={styles.modeDesc}>
                  ExoPlayer + VLC headers. Fastest, no server load.
                </Text>
              </View>
            </View>
            <View style={[styles.radio, isDirectMode && styles.radioActive]}>
              {isDirectMode && <View style={styles.radioDot} />}
            </View>
          </FocusableRow>

          {/* Proxy option */}
          <FocusableRow
            onPress={() => updateSetting('playbackMode', 'proxy')}
            style={[styles.modeOption, isProxyMode && styles.modeOptionActive]}
          >
            <View style={styles.modeLeft}>
              <View style={[styles.modeIcon, isProxyMode && styles.modeIconActive]}>
                <Ionicons name="swap-horizontal" size={20} color={isProxyMode ? '#fff' : '#555'} />
              </View>
              <View style={styles.modeText}>
                <Text style={[styles.modeTitle, isProxyMode && styles.modeTitleActive]}>
                  Proxy Stream
                </Text>
                <Text style={styles.modeDesc}>
                  Routes via your backend server. Better for restricted channels.
                </Text>
              </View>
            </View>
            <View style={[styles.radio, isProxyMode && styles.radioActive]}>
              {isProxyMode && <View style={styles.radioDot} />}
            </View>
          </FocusableRow>
        </View>

        {/* ── Auto Fallback ────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>FALLBACK</Text>
        <View style={styles.card}>
          <FocusableRow
            onPress={() => updateSetting('autoFallbackToProxy', !settings.autoFallbackToProxy)}
            style={styles.toggleRow}
          >
            <View style={styles.toggleLeft}>
              <Ionicons name="refresh-circle-outline" size={20} color="#aaa" style={{ marginRight: 12 }} />
              <View>
                <Text style={styles.toggleTitle}>Auto-fallback to Proxy</Text>
                <Text style={styles.toggleDesc}>
                  If Direct fails, automatically retry with Proxy.
                  {'\n'}Only applies when Direct mode is selected.
                </Text>
              </View>
            </View>
            <View style={[styles.toggle, settings.autoFallbackToProxy && styles.toggleOn]}>
              <View style={[styles.toggleThumb, settings.autoFallbackToProxy && styles.toggleThumbOn]} />
            </View>
          </FocusableRow>
        </View>

        {/* ── Current status ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>CURRENT STATUS</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons
              name={isDirectMode ? 'flash' : 'swap-horizontal'}
              size={18}
              color={isDirectMode ? '#e50914' : '#f90'}
              style={{ marginRight: 8 }}
            />
            <Text style={styles.statusLabel}>Active mode</Text>
            <Text style={[styles.statusValue, { color: isDirectMode ? '#e50914' : '#f90' }]}>
              {isDirectMode ? 'Direct' : 'Proxy'}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statusRow}>
            <Ionicons name="refresh" size={18} color="#888" style={{ marginRight: 8 }} />
            <Text style={styles.statusLabel}>Auto-fallback</Text>
            <Text style={[styles.statusValue, { color: settings.autoFallbackToProxy ? '#4caf50' : '#666' }]}>
              {settings.autoFallbackToProxy ? 'Enabled' : 'Disabled'}
            </Text>
          </View>
        </View>

        {/* ── Reset / Logout ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>ACTIONS</Text>
        <View style={styles.card}>
          <FocusableRow onPress={resetSettings} style={styles.actionRow}>
            <Ionicons name="refresh-outline" size={18} color="#aaa" style={{ marginRight: 12 }} />
            <Text style={styles.actionText}>Reset Settings to Default</Text>
          </FocusableRow>
          <View style={styles.divider} />
          <FocusableRow onPress={logout} style={styles.actionRow}>
            <Ionicons name="log-out-outline" size={18} color="#e50914" style={{ marginRight: 12 }} />
            <Text style={[styles.actionText, { color: '#e50914' }]}>Logout</Text>
          </FocusableRow>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 14 : 54,
    paddingBottom: 14,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    padding: 16,
  },
  sectionTitle: {
    color: '#e50914',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 20,
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    overflow: 'hidden',
  },
  cardDesc: {
    color: '#666',
    fontSize: 11,
    lineHeight: 16,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  focusedRow: {
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
    borderRadius: 8,
    zIndex: 20,
  },
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    position: 'relative',
  },
  modeOptionActive: {
    backgroundColor: '#1a0a0a',
  },
  modeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#1e1e1e',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modeIconActive: {
    backgroundColor: '#e50914',
  },
  modeText: { flex: 1 },
  modeTitle: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '600',
  },
  modeTitleActive: { color: '#fff' },
  modeDesc: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  radioActive: { borderColor: '#e50914' },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e50914',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    position: 'relative',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: 12,
  },
  toggleTitle: {
    color: '#ccc',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleDesc: {
    color: '#555',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleOn: { backgroundColor: '#e50914' },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#555',
  },
  toggleThumbOn: {
    backgroundColor: '#fff',
    alignSelf: 'flex-end',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  statusLabel: {
    color: '#666',
    fontSize: 13,
    flex: 1,
  },
  statusValue: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#1a1a1a',
    marginHorizontal: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    position: 'relative',
  },
  actionText: {
    color: '#aaa',
    fontSize: 14,
  },
  warningRow: {
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderRadius: 8,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  warningText: {
    color: '#ff9800',
    fontSize: 13,
    fontWeight: '600',
  },
  expiredRow: {
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
    borderRadius: 8,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  expiredText: {
    color: '#f44336',
    fontSize: 13,
    fontWeight: '600',
  },
});