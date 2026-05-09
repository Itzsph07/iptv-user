// src/utils/constants.js
import { Dimensions, Platform } from 'react-native';
import api from '../services/api';

const { width: SW, height: SH } = Dimensions.get('window');

// Better device detection
export const IS_TV = Platform.isTV === true;
export const IS_TABLET = !IS_TV && (Platform.isPad || (SW >= 768 && SH >= 768));
export const IS_PHONE = !IS_TV && !IS_TABLET;
export const IS_LANDSCAPE = SW > SH;

// Dynamic sidebar width based on device
export const SIDEBAR_WIDTH = (() => {
  if (IS_TV) return Math.min(SW * 0.28, 480);
  if (IS_TABLET) return Math.min(SW * 0.32, 380);
  return Math.min(SW * 0.45, 320);
})();

// Dynamic item heights based on device
export const CHANNEL_ITEM_HEIGHT = IS_TV ? 80 : (IS_TABLET ? 72 : 65);
export const GENRE_ITEM_HEIGHT = IS_TV ? 80 : (IS_TABLET ? 72 : 65);

// Dynamic font sizes - INCREASED for better readability
export const FONT_SIZES = {
  genreHeader: IS_TV ? 18 : (IS_TABLET ? 16 : 14),
  genreName: IS_TV ? 16 : (IS_TABLET ? 15 : 13),
  genreNameFocused: IS_TV ? 17 : (IS_TABLET ? 16 : 14),
  channelHeader: IS_TV ? 18 : (IS_TABLET ? 16 : 14),
  channelName: IS_TV ? 15 : (IS_TABLET ? 14 : 13),
  channelNameFocused: IS_TV ? 16 : (IS_TABLET ? 15 : 14),
};

// TV focus scale
export const TV_FOCUS_SCALE = IS_TV ? 1.05 : 1.03;

export const GENRE_COLUMN_WIDTH = IS_TV ? 220 : (IS_TABLET ? 190 : 170);
export const CONTROLS_HIDE_MS = 4000;
export const DOUBLE_TAP_MS = 300;
export const STREAM_TIMEOUT_MS = 8000;
export const BUFFERING_TIMEOUT_MS = 5000;
export const MAX_AUTO_RETRIES = 3;

export const PROXY_BASE = (() => {
  try { return api.defaults.baseURL.replace(/\/api\/?$/, '') + '/api/proxy/stream'; }
  catch (_) { return 'http://192.168.100.229:5000/api/proxy/stream'; }
})();

export const COLORS = {
  primary: '#e50914',
  primaryDark: '#b20710',
  background: '#0a0a0a',
  sidebar: '#111111',
  sidebarLight: '#1a1a1a',
  active: '#330000',
  focused: '#e50914',
  focusedLight: '#ff1a1a',
  text: '#ffffff',
  textSecondary: '#999999',
  textMuted: '#666666',
  border: '#2a2a2a',
  borderLight: '#3a3a3a',
  hd: '#4fc3f7',
  lastChannel: '#f9a825',
  success: '#4caf50',
  warning: '#ff9800',
  preview: '#3498db',
  previewBorder: '#2980b9',
};