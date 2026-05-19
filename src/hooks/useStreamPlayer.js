// src/hooks/useStreamPlayer.js
import { useRef, useState, useCallback, useEffect } from 'react';
import api from '../services/api';
import { PROXY_BASE, STREAM_TIMEOUT_MS } from '../utils/constants';
import { useSettings } from '../context/SettingsContext';

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
  const [videoFormat, setVideoFormat] = useState('h264');
  const [audioFormat, setAudioFormat] = useState('aac');
  const [useSoftwareDecoder, setUseSoftwareDecoder] = useState(false);
  
  const videoFormatRef = useRef('h264');
  const audioFormatRef = useRef('aac');
  const softwareDecoderRef = useRef(false);
  const videoRef = useRef(null);
  const abortControllerRef = useRef(null);
  const streamTimeoutRef = useRef(null);
  const currentLoadIdRef = useRef(0);
  const currentChannelRef = useRef(null);
  const loadStreamTimeoutRef = useRef(null);

  // Sync with settings
  useEffect(() => {
    setUseSoftwareDecoder(settings.forceSoftwareDecoder ?? false);
    softwareDecoderRef.current = settings.forceSoftwareDecoder ?? false;
  }, [settings.forceSoftwareDecoder]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (streamTimeoutRef.current) {
        clearTimeout(streamTimeoutRef.current);
      }
    };
  }, []);

  // Reload when software decoder setting changes
 // useEffect(() => /*/{
   // console.log(`🔀 Decoder: ${settings.forceSoftwareDecoder ? 'SOFTWARE (ExoPlayer)' : 'HARDWARE'}`);
    //if (currentChannelRef.current) {
     // setTimeout(() => loadStream(currentChannelRef.current), 100);
    //}
  //},*/ [settings.forceSoftwareDecoder]);

  const loadStream = useCallback(async (channel) => {
    if (!channel) return;

    const loadId = Date.now();
    currentLoadIdRef.current = loadId;

    const vFmt = videoFormatRef.current;
    const aFmt = audioFormatRef.current;
    const swDec = softwareDecoderRef.current;
    const useProxy = settings.playbackMode === 'proxy';

    console.log(`🚀 loadStream: ${channel.name} | video=${vFmt} audio=${aFmt} decoder=${swDec ? 'SOFTWARE' : 'HW'} | mode=${useProxy ? 'PROXY' : 'DIRECT'}`);

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

    if (abortControllerRef.current) { 
      abortControllerRef.current.abort(); 
      abortControllerRef.current = null; 
    }
    if (streamTimeoutRef.current) { 
      clearTimeout(streamTimeoutRef.current); 
      streamTimeoutRef.current = null; 
    }

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
          setError('Stream timed out');
          setLoading(false);
        }
      }, STREAM_TIMEOUT_MS);

      // ===================================================================
      // ★ SOFTWARE DECODER MODE - ExoPlayer with useTextureView=true ★
      // ===================================================================
      if (swDec) {
          console.log('🎬 SW BRANCH HIT, sending useSoftwareDecoder:true');

        setUsingProxy(false);
        setStreamSource({ 
          uri: plain,
          useSoftwareDecoder: true,
          headers: { 
            'User-Agent': 'Lavf53.32.100',
            'Connection': 'keep-alive'
          },
          type: plain.includes('.m3u8') ? 'm3u8' : 'mpegts',
        });
        setVideoKey(k => k + 1);
        return;
      }

      // ===================================================================
      // PROXY MODE (Server-side transcoding)
      // ===================================================================
      if (useProxy) {
        const macParam = channel.macAddress ? `&mac=${encodeURIComponent(channel.macAddress)}` : '';
        const typParam = isMag ? '&type=mag' : '&type=xtream';
        const fmtParam = `&videoFormat=${vFmt}&audioFormat=${aFmt}&container=ts&h264_profile=baseline&h264_level=3.1&force_sw=1`;
        const extraParams = `&reconnect=1&reconnect_streamed=1&reconnect_delay_max=5&timeout=30&seekable=0`;

        const proxyUri = `${PROXY_BASE}?url=${encodeURIComponent(plain)}${macParam}${typParam}&channelId=${channelId}${fmtParam}${extraParams}`;

        console.log(`📺 PROXY MODE (SERVER)`);
        setUsingProxy(true);
        setStreamSource({ uri: proxyUri,
          useSoftwareDecoder: swDec,
         });
        
      } else {
        // DIRECT MODE
        console.log(`📺 DIRECT MODE`);
        setUsingProxy(false);
        setStreamSource({ uri: plain,
          useSoftwareDecoder: swDec,
         });
      }

      setVideoKey(k => k + 1);

    } catch (err) {
      if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.isCancelled) return;
      console.log(`❌ loadStream error: ${err.message}`);
      if (currentLoadIdRef.current === loadId) { 
        setError(err.message); 
        setLoading(false); 
      }
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
    if (streamTimeoutRef.current) { 
      clearTimeout(streamTimeoutRef.current); 
      streamTimeoutRef.current = null; 
    }
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

  const handleSetVideoFormat = useCallback((fmt) => {
    videoFormatRef.current = fmt;
    setVideoFormat(fmt);
    if (loadStreamTimeoutRef.current) clearTimeout(loadStreamTimeoutRef.current);
    if (currentChannelRef.current) {
      loadStreamTimeoutRef.current = setTimeout(() => loadStream(currentChannelRef.current), 500);
    }
  }, [loadStream]);

  const handleSetAudioFormat = useCallback((fmt) => {
    audioFormatRef.current = fmt;
    setAudioFormat(fmt);
    if (loadStreamTimeoutRef.current) clearTimeout(loadStreamTimeoutRef.current);
    if (currentChannelRef.current) {
      loadStreamTimeoutRef.current = setTimeout(() => loadStream(currentChannelRef.current), 500);
    }
  }, [loadStream]);

  const toggleSoftwareDecoder = useCallback(() => {
    const newValue = !softwareDecoderRef.current;
    softwareDecoderRef.current = newValue;
    setUseSoftwareDecoder(newValue);
    if (loadStreamTimeoutRef.current) clearTimeout(loadStreamTimeoutRef.current);
    if (currentChannelRef.current) {
      loadStreamTimeoutRef.current = setTimeout(() => loadStream(currentChannelRef.current), 500);
    }
  }, [loadStream]);

  return {
    videoRef, streamSource, loading, isPlaying, usingProxy, error, videoKey,
    videoFormat, audioFormat, useSoftwareDecoder,
    onLoad, onStatusUpdate, setStreamSource,
    setVideoFormat: handleSetVideoFormat,
    setAudioFormat: handleSetAudioFormat,
    toggleSoftwareDecoder,
    availableVideoFormats: VIDEO_FORMATS,
    availableAudioFormats: AUDIO_FORMATS,
    loadStream, releaseStream, prefetchStream,
  };
};
