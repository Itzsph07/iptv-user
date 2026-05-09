// services/channelService.js – SIMPLIFIED VERSION
// Fixes:
//  1. No sync calls - backend handles token refresh automatically
//  2. Clean URL construction without extra complexity
//  3. Proper Xtream/MAG URL detection

import api      from './api';
import { Platform } from 'react-native';

class ChannelService {

  // ─── Public API ──────────────────────────────────────────────────────────

  async getMyChannels() {
    try {
        const r = await api.get('/customers/my-channels');
        const channels = r.data.channels || [];
        
        console.log('Channels received from backend:', channels.length);
        if (channels.length > 0) {
            console.log('Sample channel:', {
                name: channels[0].name,
                hasMacAddress: !!channels[0].macAddress,
                macAddress: channels[0].macAddress,
                hasStreamingToken: !!channels[0].streamingToken,
                hasStreamUrl: !!channels[0].streamUrl,
                hasSourcePlaylist: !!channels[0].sourcePlaylist
            });
        }
        
        return channels;
    } catch (e) { 
        console.error('getMyChannels:', e); 
        throw e; 
    }
  }

  async getMyPlaylist() {
    try {
      const r = await api.get('/customers/my-playlist');
      return r.data.playlist || [];
    } catch (e) { console.error('getMyPlaylist:', e); throw e; }
  }

  // ─── Get ONE fresh URL from backend ──────────────────────────────────────

  async getChannelStream(channel) {
    if (channel.cmd || channel.channelId) {
      try {
        console.log('🔄 Requesting stream URL for:', channel.name);
        
        // Single call to get-stream endpoint
        const r = await api.post('/channels/get-stream', {
          playlistId: channel.playlistId,
          channelId:  channel.channelId,
          cmd:        channel.cmd || '',
        });
        
        if (r.data?.url) {
          console.log('✅ Stream URL:', r.data.url);
          return r.data.url;
        }
        
      } catch (e) {
        console.error('❌ get-stream failed:', e.message);
        const extracted = this._extractUrl(channel.cmd);
        if (extracted) { 
          console.warn('⚠️ Using stored URL from cmd'); 
          return extracted; 
        }
      }
    }
    
    console.warn('⚠️ Using channel.url as last resort');
    return channel.url;
  }

  // ─── Build all strategies (ONE network call) ──────────────────────────────

  async getStreamWithAllStrategies(channel) {
    console.log('📋 Building streaming strategies for:', channel.name);

    const freshUrl = await this.getChannelStream(channel);
    if (!freshUrl) throw new Error('Could not obtain stream URL');

    let uri = this._cleanUrl(freshUrl) || freshUrl;

    if (this._isXtreamUrl(uri)) {
      uri = uri.split('?')[0].split('#')[0].replace(/\/$/, '');
      if (!/\.(ts|m3u8|mp4)$/i.test(uri)) uri += '.ts';
      console.log('🔗 Xtream URL (cleaned):', uri);
    } else {
      console.log('🔗 Using URI:', uri);
    }

    const mac    = channel.macAddress || '00:1A:79:00:00:00';
    const domain = this._baseDomain(uri) || '';
    const creds  = this._credsFromUrl(uri);

    const strategies = Platform.OS === 'android'
      ? this._android(uri, mac, domain, creds)
      : this._ios(uri, mac, domain, creds);

    strategies.forEach((s, i) =>
      console.log(`  ✅ Strategy ${i + 1}: ${s.strategyName}`)
    );
    console.log(`📊 ${strategies.length} strategies ready`);
    return strategies;
  }

  // ─── Strategy sets ────────────────────────────────────────────────────────

  _android(uri, mac, domain, creds) {
    return [
   {
  strategyName: 'Android ExoPlayer (Fuego Optimized)',
  headers: {
    'User-Agent': 'ExoPlayer/2.18.1 (Linux; Android 10) ExoPlayerLib/2.18.1',
    'Accept': 'video/mp2t, video/mp4, audio/mp4, audio/aac, audio/mpeg, audio/opus, audio/ogg, audio/webm, application/vnd.apple.mpegurl, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
    'X-ExoPlayer-Version': '2.18.1',
    'X-Android-Drm': 'clear', // Prevents DRM issues on Fuego
    'X-Requested-With': 'com.mesashop.iptv', // Your package name
  },
      },
      {
        strategyName: 'OTT Navigator',
        headers: {
          'User-Agent':      'OTT Navigator/1.6.7 (Linux; Android 10)',
          'Accept':          '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          'Connection':      'keep-alive',
          ...(creds && { 'Authorization': `Basic ${this._b64(`${creds.u}:${creds.p}`)}` }),
        },
      },
      {
        strategyName: 'IPTV Smarters',
        headers: {
          'User-Agent':      'IPTV Smarters/3.0 (Android; 10)',
          'Accept':          'video/mp2t, application/vnd.apple.mpegurl, */*',
          'Accept-Encoding': 'identity',
          'Connection':      'keep-alive',
        },
      },
      
      {
        strategyName: 'MAG Device',
        headers: {
          'User-Agent':    'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
          'X-User-Agent':  'Model: MAG250; Link: WiFi',
          'Accept':        '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          'Connection':    'keep-alive',
          'Cookie':        `mac=${mac}; stb_lang=en; timezone=GMT`,
          ...(domain && { 'Referer': `${domain}/c/` }),
        },
      },
      {
        strategyName: 'Basic Auth',
        headers: {
          'User-Agent':      'Lavf/58.76.100',
          'Accept':          'video/mp2t, */*',
          'Accept-Encoding': 'identity',
          'Connection':      'keep-alive',
          ...(creds && { 'Authorization': `Basic ${this._b64(`${creds.u}:${creds.p}`)}` }),
        },
      },
      {
        strategyName: 'Chrome Browser',
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept':          '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          'Connection':      'keep-alive',
          ...(domain && { 'Referer': `${domain}/`, 'Origin': domain }),
        },
      },
      {
        strategyName: 'Simple Stream',
        headers: { 'User-Agent': 'ExoPlayer/2.18.1', 'Accept': '*/*' },
      },
    ].map((s, i) => ({ ...s, uri, strategyId: i + 1 }));
  }

  _ios(uri, mac, domain, creds) {
    return [
      {
        strategyName: 'VLC Compatible',
        headers: {
          'User-Agent':      'VLC/3.0.18 LibVLC/3.0.18',
          'Accept':          'video/mp2t, video/quicktime, video/*, */*',
          'Accept-Language': 'en-US,*',
          'Accept-Encoding': 'identity',
          'Connection':      'keep-alive',
          'Icy-MetaData':    '1',
        },
      },
      {
        strategyName: 'Chrome Browser',
        headers: {
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept':          '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
          'Connection':      'keep-alive',
          ...(domain && { 'Referer': `${domain}/`, 'Origin': domain }),
        },
      },
      {
        strategyName: 'MAG Device',
        headers: {
          'User-Agent':    'Mozilla/5.0 (QtEmbedded; U; Linux; C) AppleWebKit/533.3 (KHTML, like Gecko) MAG200 stbapp ver: 2 rev: 250 Safari/533.3',
          'X-User-Agent':  'Model: MAG250; Link: WiFi',
          'Accept':        '*/*',
          'Accept-Encoding': 'identity',
          'Cookie':        `mac=${mac}; stb_lang=en; timezone=GMT`,
          ...(domain && { 'Referer': `${domain}/c/` }),
        },
      },
      {
        strategyName: 'Simple Stream',
        headers: { 'User-Agent': 'AppleCoreMedia/1.0', 'Accept': '*/*' },
      },
    ].map((s, i) => ({ ...s, uri, strategyId: i + 1 }));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  _isXtreamUrl(url) {
    if (!url) return false;
    const base  = url.split('?')[0].split('#')[0];
    const m     = base.match(/^https?:\/\/[^/]+(\/.*)?$/);
    if (!m) return false;
    const parts = (m[1] || '').split('/').filter(Boolean);
    const last  = parts[parts.length - 1] || '';
    return parts.length === 3 && /^\d+(\.(ts|m3u8|mp4))?$/i.test(last);
  }

  _extractUrl(raw) {
    if (!raw) return null;
    const s = String(raw).replace(/^ff(mpeg|rt)\s+/i, '').replace(/[\t\n\r]/g, '').trim();
    const m = s.match(/https?:\/\/\S+/);
    return m ? m[0] : null;
  }

  _cleanUrl(url) {
    if (!url) return null;
    return String(url).replace(/^ff(mpeg|rt)\s+/i, '').replace(/[\t\n\r]/g, '').trim();
  }

  _baseDomain(url) {
    try { const u = new URL(url); return `${u.protocol}//${u.host}`; } catch (_) { return null; }
  }

  _credsFromUrl(url) {
    try {
      const parts = new URL(url).pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && !/^\d+$/.test(parts[0])) {
        return { u: parts[0], p: parts[1] };
      }
    } catch (_) {}
    return null;
  }

  _b64(str) {
    try { return btoa(str); } catch (_) { return Buffer.from(str).toString('base64'); }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  groupChannelsByCategory(channels) {
    if (!Array.isArray(channels)) return {};
    return channels.reduce((acc, ch) => {
      const g = ch.group || 'Uncategorized';
      (acc[g] = acc[g] || []).push(ch);
      return acc;
    }, {});
  }

  searchChannels(channels, query) {
    if (!query || !Array.isArray(channels)) return channels || [];
    const q = query.toLowerCase();
    return channels.filter(ch => ch.name?.toLowerCase().includes(q));
  }
}

export default new ChannelService();