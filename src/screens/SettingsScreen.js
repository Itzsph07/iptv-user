// screens/SettingsScreen.js
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen({ navigation }) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { user, logout } = useAuth();

  const isDirectMode = settings.playbackMode === 'direct';
  const isProxyMode  = settings.playbackMode === 'proxy';

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Playback Mode ────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>PLAYBACK MODE</Text>
        <View style={styles.card}>
          <Text style={styles.cardDesc}>
            Choose how channels are streamed. Direct is faster when your network
            allows it. Proxy routes the stream through your server, which helps
            with channels that block direct access.
          </Text>

          {/* Direct option */}
          <TouchableOpacity
            style={[styles.modeOption, isDirectMode && styles.modeOptionActive]}
            onPress={() => updateSetting('playbackMode', 'direct')}
            activeOpacity={0.75}
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
          </TouchableOpacity>

          {/* Proxy option */}
          <TouchableOpacity
            style={[styles.modeOption, isProxyMode && styles.modeOptionActive]}
            onPress={() => updateSetting('playbackMode', 'proxy')}
            activeOpacity={0.75}
          >
            <View style={styles.modeLeft}>
              <View style={[styles.modeIcon, isProxyMode && styles.modeIconActive, styles.modeIconProxy]}>
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
            <View style={[styles.radio, isProxyMode && styles.radioActive, styles.radioProxy]}>
              {isProxyMode && <View style={styles.radioDot} />}
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Auto Fallback ────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>FALLBACK</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.toggleRow}
            onPress={() => updateSetting('autoFallbackToProxy', !settings.autoFallbackToProxy)}
            activeOpacity={0.75}
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
          </TouchableOpacity>
        </View>

        {/* ── Current status ───────────────────────────────────── */}
        <Text style={styles.sectionTitle}>CURRENT STATUS</Text>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <Ionicons name="person-circle-outline" size={18} color="#888" style={{ marginRight: 8 }} />
            <Text style={styles.statusLabel}>Logged in as</Text>
            <Text style={styles.statusValue}>{user?.username || '—'}</Text>
          </View>
          <View style={styles.divider} />
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
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow} onPress={resetSettings} activeOpacity={0.75}>
            <Ionicons name="refresh-outline" size={18} color="#aaa" style={{ marginRight: 12 }} />
            <Text style={styles.actionText}>Reset Settings to Default</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.actionRow} onPress={logout} activeOpacity={0.75}>
            <Ionicons name="log-out-outline" size={18} color="#e50914" style={{ marginRight: 12 }} />
            <Text style={[styles.actionText, { color: '#e50914' }]}>Logout</Text>
          </TouchableOpacity>
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
  backBtn: { padding: 6 },
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

  // Mode options
  modeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
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
  modeIconProxy: {},
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
  radioProxy: {},
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#e50914',
  },

  // Toggle
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
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

  // Status
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

  // Action rows
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  actionText: {
    color: '#aaa',
    fontSize: 14,
  },
});