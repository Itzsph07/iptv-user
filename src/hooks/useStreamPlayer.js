// src/hooks/useStreamPlayer.js
import { useRef, useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { PROXY_BASE, STREAM_TIMEOUT_MS } from '../utils/constants';
import { useSettings } from '../context/SettingsContext';
import * as FileSystem from 'expo-file-system';

// Try to import FFmpeg - will be undefined if not installed yet
let localFFmpeg = null;
try {
  localFFmpeg = require('../services/localFFmpeg').default;
} catch (e) {
  console.log('⚠️ localFFmpeg not available yet');
}

export const VIDEO_FORMATS = [
  { value: 'copy',  label: 'Original',      desc: 'No transcoding · may green-screen' },
  { value: 'h264',  label: 'H.264',         desc: '✅ Fixes green screen · use this first' },
  { value: 'h265',  label: 'H.265 / HEVC',  desc: 'Better compression · higher CPU on server' },
  { value: 'mpeg4', label: 'MPEG-4',        desc: 'Legacy fallback' },
  { value: 'mpeg2', label: 'MPEG-2',        desc: '⭐ Most compatible · works on ALL devices' },
];

export const AUDIO_FORMATS = [
  { value: 'copy',  label: 'Original', desc: '⚠️ May crash on MP2 streams (Qualcomm bug)' },
  { value: 'aac',   label: 'AAC',      desc: '✅ Default · fixes MP2 crash · most compatible' },
  { value: 'mp3',   label: 'MP3',      desc: 'Universal fallback' },
  { value: 'ac3',   label: 'AC3',      desc: 'Dolby Digital' },
  { value: 'eac3',  label: 'E-AC3',    desc: 'Dolby Digital Plus' },
];

export const useStreamPlayer = () => {
  const { settings } = useSettings();
  
  const [streamSource, setStreamSource] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [usingProxy, setUsingProxy] = useState(false);
  const [error, setError] = useState(null);
  const [videoKey, setVideoKey] = useState(0);
  const [videoFormat, _setVideoFormat] = useState('h264');
  const [audioFormat, _setAudioFormat] = useState('aac');
  
  const videoFormatRef = useRef('h264');
  const audioFormatRef = useRef('aac');
  const softwareDecoderRef = useRef(settings.forceSoftwareDecoder);
  const videoRef = useRef(null);
  const abortControllerRef = useRef(null);
  const streamTimeoutRef = useRef(null);
  const currentLoadIdRef = useRef(0);
  const currentChannelRef = useRef(null);
  const loadStreamTimeoutRef = useRef(null);
  const localOutputPathRef = useRef(null);

  // ===== CLEANUP LOCAL FFMPEG FILES ON UNMOUNT =====
  useEffect(() => {
    return () => {
      if (localFFmpeg) {
        localFFmpeg.stopTranscoding();
      }
      // Clean up old cached files
      if (localOutputPathRef.current) {
        FileSystem.deleteAsync(localOutputPathRef.current, { idempotent: true }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    softwareDecoderRef.current = settings.forceSoftwareDecoder;
    console.log(`🔀 Decoder setting synced: ${settings.forceSoftwareDecoder ? 'SOFTWARE (LOCAL FFMPEG)' : 'HARDWARE'}`);
    
    if (currentChannelRef.current) {
      setTimeout(() => loadStream(currentChannelRef.current), 100);
    }
  }, [settings.forceSoftwareDecoder]);

  const loadStream = useCallback(async (channel) => {
    if (!channel) return;

    const loadId = Date.now();
    currentLoadIdRef.current = loadId;

    const vFmt = videoFormatRef.current;
    const aFmt = audioFormatRef.current;
    const swDec = softwareDecoderRef.current;
    const useProxy = settings.playbackMode === 'proxy';

    console.log(`🚀 loadStream: ${channel.name} | video=${vFmt} audio=${aFmt} decoder=${swDec ? 'LOCAL_FFMPEG' : 'HW'} | mode=${useProxy ? 'PROXY' : 'DIRECT'}`);

    // Stop any previous local FFmpeg
    if (localFFmpeg) {
      await localFFmpeg.stopTranscoding();
    }

    // Release previous channel
    if (currentChannelRef.current) {
      try {
        await api.post('/channels/release-stream', {
          playlistId: currentChannelRef.current.playlistId || currentChannelRef.current.sourcePlaylist?.id,
          channelId:  currentChannelRef.current.channelId  || currentChannelRef.current._id,
          macAddress: currentChannelRef.current.macAddress,
          cmd:        currentChannelRef.current.cmd || '',
        });
      } catch (_) {}
    }

    if (abortControllerRef.current) { abortControllerRef.current.abort(); abortControllerRef.current = null; }
    if (streamTimeoutRef.current) { clearTimeout(streamTimeoutRef.current); streamTimeoutRef.current = null; }

    setLoading(true);
    setError(null);
    setStreamSource(null);
    setIsPlaying(false);

    currentChannelRef.current = channel;

    await new Promise(r => setTimeout(r, 300));

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (controller.signal.aborted || currentLoadIdRef.current !== loadId) return;

      const playlistId = channel.sourcePlaylist?.id || channel.playlistId;
      const channelId  = String(channel.channelId || channel._id);

      const response = await api.post('/channels/get-stream-single', {
        playlistId, channelId, cmd: channel.cmd || '',
      }, { signal: controller.signal, timeout: 8000 });

      if (controller.signal.aborted || currentLoadIdRef.current !== loadId) return;
      if (!response.data?.url) throw new Error('No stream URL');

      const plain = decodeURIComponent(response.data.url);
      const isMag = channel.playlistType === 'mag' || channel.playlistType === 'stalker';

      if (controller.signal.aborted || currentLoadIdRef.current !== loadId) return;

      streamTimeoutRef.current = setTimeout(() => {
        if (currentLoadIdRef.current === loadId) {
          setError('Stream timed out — try enabling Software Decoder in Settings');
          setLoading(false);
        }
      }, STREAM_TIMEOUT_MS);

      // ===================================================================
      // ★★★ LOCAL FFMPEG MODE (Software Decoder ON) ★★★
      // ===================================================================
      if (swDec && localFFmpeg) {
        console.log('🎬 LOCAL FFMPEG MODE - Transcoding on device');
        
        const macParam = channel.macAddress ? `&mac=${encodeURIComponent(channel.macAddress)}` : '';
        const proxyUri = `${PROXY_BASE}?url=${encodeURIComponent(plain)}${macParam}&channelId=${channelId}&_=${Date.now()}`;
        
        const outputPath = `${FileSystem.cacheDirectory}stream_${loadId}.ts`;
        localOutputPathRef.current = outputPath;
        
        console.log(`📡 Proxy URL: ${proxyUri.substring(0, 80)}...`);
        console.log(`💾 Output: ${outputPath}`);
        
        setUsingProxy(true);
        setStreamSource({ uri: proxyUri }); // Show loading state
        
        // Start local FFmpeg in background
        localFFmpeg.startTranscoding(proxyUri, outputPath).then(result => {
          if (currentLoadIdRef.current !== loadId) return; // Stale request
          
          if (result.success) {
            console.log('✅ Local FFmpeg success');
            setStreamSource({ uri: outputPath, type: 'mpegts' });
          } else {
            console.error('❌ Local FFmpeg failed:', result.error);
            setError('Local transcoding failed: ' + (result.error || 'Unknown error'));
            setLoading(false);
          }
        }).catch(err => {
          if (currentLoadIdRef.current !== loadId) return;
          console.error('❌ Local FFmpeg exception:', err.message);
          setError('Local FFmpeg error: ' + err.message);
          setLoading(false);
        });
        
        setVideoKey(k => k + 1);
        return; // Don't fall through to proxy/direct code
      }

      // ===================================================================
      // PROXY MODE (Server-side, no local FFmpeg)
      // ===================================================================
      if (useProxy) {
        const macParam = channel.macAddress ? `&mac=${encodeURIComponent(channel.macAddress)}` : '';
        const typParam = isMag ? '&type=mag' : '&type=xtream';
        const fmtParam = `&videoFormat=${vFmt}&audioFormat=${aFmt}&container=ts&h264_profile=baseline&h264_level=3.1&force_sw=1`;
        const extraParams = `&reconnect=1&reconnect_streamed=1&reconnect_delay_max=5&timeout=30&seekable=0`;
        const cacheBuster = `&_=${Date.now()}`;

        const proxyUri = `${PROXY_BASE}?url=${encodeURIComponent(plain)}${macParam}${typParam}&channelId=${channelId}${fmtParam}${cacheBuster}${extraParams}`;

        console.log(`📺 PROXY MODE (SERVER) | video: ${vFmt}`);
        setUsingProxy(true);
        setStreamSource({ uri: proxyUri });
      } else {
        // DIRECT MODE
        console.log(`📺 DIRECT MODE | URL: ${plain.substring(0, 120)}...`);
        setUsingProxy(false);
        setStreamSource({ uri: plain });
      }

      setVideoKey(k => k + 1);

    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.isCancelled) return;
      console.log(`❌ loadStream error: ${err.message}`);
      if (currentLoadIdRef.current === loadId) { setError(err.message); setLoading(false); }
    }
  }, [settings.playbackMode]);

  const releaseStream = useCallback(async (channel) => {
    if (!channel) return;
    api.post('/channels/release-stream', {
      playlistId: channel.playlistId,
      channelId:  channel.channelId || channel._id,
      cmd:        channel.cmd || '',
    }).catch(() => {});
  }, []);

  const prefetchStream = useCallback(async (channel) => {
    if (!channel) return;
    try {
      const playlistId = channel.sourcePlaylist?.id || channel.playlistId;
      const channelId  = String(channel.channelId || channel._id);
      await api.post('/channels/get-stream-single', { playlistId, channelId, cmd: channel.cmd || '' });
    } catch (_) {}
  }, []);

  const onLoad = useCallback(() => {
    console.log('✅ Video loaded');
    if (streamTimeoutRef.current) { clearTimeout(streamTimeoutRef.current); streamTimeoutRef.current = null; }
    setLoading(false);
    setIsPlaying(true);
    setError(null);
  }, []);

  const onStatusUpdate = useCallback((status) => {
    if (!status) return;
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    } else if (status.error) {
      console.log('❌ Playback error:', status.error);
      setError(status.error);
      setLoading(false);
    }
  }, []);

  const setVideoFormat = useCallback((fmt) => {
    videoFormatRef.current = fmt;
    _setVideoFormat(fmt);
    console.log(`🎬 Video format → ${fmt}`);
    
    if (loadStreamTimeoutRef.current) clearTimeout(loadStreamTimeoutRef.current);
    if (currentChannelRef.current) {
      loadStreamTimeoutRef.current = setTimeout(() => {
        loadStream(currentChannelRef.current);
      }, 500);
    }
  }, [loadStream]);

  const setAudioFormat = useCallback((fmt) => {
    audioFormatRef.current = fmt;
    _setAudioFormat(fmt);
    console.log(`🔊 Audio format → ${fmt}`);
    
    if (loadStreamTimeoutRef.current) clearTimeout(loadStreamTimeoutRef.current);
    if (currentChannelRef.current) {
      loadStreamTimeoutRef.current = setTimeout(() => {
        loadStream(currentChannelRef.current);
      }, 500);
    }
  }, [loadStream]);

  return {
    videoRef, streamSource,
    loading, isPlaying, usingProxy, error, videoKey,
    videoFormat, audioFormat, 
    useSoftwareDecoder: settings.forceSoftwareDecoder,
    onLoad, onStatusUpdate, setStreamSource,
    setVideoFormat, setAudioFormat,
    availableVideoFormats: VIDEO_FORMATS,
    availableAudioFormats: AUDIO_FORMATS,
    loadStream, releaseStream, prefetchStream,
  };
};