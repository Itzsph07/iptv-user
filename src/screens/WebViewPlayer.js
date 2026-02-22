// screens/WebViewPlayer.js
// Universal WebView player for streams that are blocked by direct playback
// Uses HLS.js to bypass header restrictions

import React, { useRef, useState, useEffect } from 'react';
import { WebView } from 'react-native-webview';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';

export default function WebViewPlayer({ route, navigation }) {
  useKeepAwake();
  
  const { url, title, channel } = route.params;
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      navigation.goBack();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  // HTML with HLS.js for bypassing header restrictions
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/hls.js@1.4.12/dist/hls.min.js"></script>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body, html {
            width: 100%;
            height: 100%;
            background: #000;
            overflow: hidden;
          }
          #video-container {
            position: relative;
            width: 100%;
            height: 100%;
            background: #000;
          }
          video {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
          }
          #status {
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.8);
            color: #fff;
            padding: 10px 20px;
            border-radius: 5px;
            font-size: 14px;
            display: none;
            z-index: 10;
          }
          #status.show { display: block; }
          #status.error { background: rgba(229, 9, 20, 0.9); }
          #status.success { background: rgba(76, 175, 80, 0.9); }
        </style>
      </head>
      <body>
        <div id="video-container">
          <video id="video" controls autoplay playsinline webkit-playsinline x-webkit-airplay="allow"></video>
          <div id="status"></div>
        </div>
        
        <script>
          const video = document.getElementById('video');
          const status = document.getElementById('status');
          const streamUrl = ${JSON.stringify(url)};
          
          function sendMessage(type, message) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type, message }));
            } catch(e) {
              console.error('postMessage failed:', e);
            }
          }

          function showStatus(msg, type = 'info', duration = 3000) {
            status.textContent = msg;
            status.className = 'show ' + type;
            if (duration > 0) {
              setTimeout(() => status.className = '', duration);
            }
          }

          console.log('Stream URL:', streamUrl);
          sendMessage('log', 'Loading stream: ' + streamUrl);

          // Try HLS.js first (best for compatibility)
          if (Hls.isSupported()) {
            console.log('Using HLS.js');
            const hls = new Hls({
              debug: false,
              enableWorker: true,
              lowLatencyMode: false,
              backBufferLength: 90,
              maxBufferLength: 30,
              maxMaxBufferLength: 600,
              maxBufferSize: 60 * 1000 * 1000,
              maxBufferHole: 0.5,
              highBufferWatchdogPeriod: 2,
              nudgeOffset: 0.1,
              nudgeMaxRetry: 3,
              maxFragLookUpTolerance: 0.25,
              liveSyncDurationCount: 3,
              liveMaxLatencyDurationCount: Infinity,
              liveDurationInfinity: false,
              liveBackBufferLength: 0,
              maxLiveSyncPlaybackRate: 1,
              manifestLoadingTimeOut: 10000,
              manifestLoadingMaxRetry: 4,
              manifestLoadingRetryDelay: 1000,
              levelLoadingTimeOut: 10000,
              levelLoadingMaxRetry: 4,
              levelLoadingRetryDelay: 1000,
              fragLoadingTimeOut: 20000,
              fragLoadingMaxRetry: 6,
              fragLoadingRetryDelay: 1000,
              startFragPrefetch: false,
              testBandwidth: true,
              progressive: false,
              xhrSetup: function(xhr, url) {
                // Don't add custom headers - let browser handle it
                xhr.withCredentials = false;
              }
            });
            
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, function() {
              console.log('Manifest parsed');
              showStatus('Stream loaded', 'success', 2000);
              video.play()
                .then(() => {
                  sendMessage('loaded', 'Playing');
                  console.log('Playing');
                })
                .catch(e => {
                  console.error('Play failed:', e);
                  showStatus('Play failed: ' + e.message, 'error', 5000);
                  sendMessage('error', 'Play failed: ' + e.message);
                });
            });
            
            hls.on(Hls.Events.ERROR, function(event, data) {
              console.error('HLS error:', data.type, data.details, data.fatal);
              
              if (data.fatal) {
                switch(data.type) {
                  case Hls.ErrorTypes.NETWORK_ERROR:
                    console.log('Network error - attempting recovery');
                    showStatus('Network error - retrying...', 'error', 3000);
                    hls.startLoad();
                    break;
                    
                  case Hls.ErrorTypes.MEDIA_ERROR:
                    console.log('Media error - attempting recovery');
                    showStatus('Media error - recovering...', 'error', 3000);
                    hls.recoverMediaError();
                    break;
                    
                  default:
                    console.error('Fatal error - cannot recover');
                    showStatus('Stream failed: ' + data.details, 'error', 0);
                    sendMessage('error', 'Fatal error: ' + data.details);
                    hls.destroy();
                    break;
                }
              }
            });
            
            // Buffering feedback
            hls.on(Hls.Events.FRAG_BUFFERED, function() {
              console.log('Fragment buffered');
            });
            
          } else if (video.canPlayType('application/vnd.apple.mpegurl') ||
                     video.canPlayType('application/x-mpegURL')) {
            // Native HLS support (iOS Safari)
            console.log('Using native HLS');
            video.src = streamUrl;
            
            video.addEventListener('loadedmetadata', function() {
              console.log('Metadata loaded');
              showStatus('Stream ready', 'success', 2000);
              video.play()
                .then(() => {
                  sendMessage('loaded', 'Playing');
                  console.log('Playing');
                })
                .catch(e => {
                  console.error('Play failed:', e);
                  showStatus('Play failed', 'error', 5000);
                  sendMessage('error', 'Play failed: ' + e.message);
                });
            });
            
            video.addEventListener('error', function(e) {
              const error = video.error;
              let msg = 'Video error';
              if (error) {
                msg += ' (code ' + error.code + ')';
                switch(error.code) {
                  case 1: msg += ': Aborted'; break;
                  case 2: msg += ': Network error'; break;
                  case 3: msg += ': Decode error'; break;
                  case 4: msg += ': Format not supported'; break;
                }
              }
              console.error(msg);
              showStatus(msg, 'error', 0);
              sendMessage('error', msg);
            });
            
          } else {
            // Fallback: try direct MPEG-TS
            console.log('Trying direct video');
            video.src = streamUrl;
            video.addEventListener('error', function() {
              const msg = 'Format not supported on this device';
              console.error(msg);
              showStatus(msg, 'error', 0);
              sendMessage('error', msg);
            });
          }

          // General video events
          video.addEventListener('waiting', () => {
            console.log('Buffering...');
            showStatus('Buffering...', 'info', 0);
          });

          video.addEventListener('playing', () => {
            console.log('Playing');
            status.className = '';
          });

          video.addEventListener('pause', () => {
            console.log('Paused');
          });

          video.addEventListener('ended', () => {
            console.log('Stream ended');
            showStatus('Stream ended', 'info', 3000);
          });
        </script>
      </body>
    </html>
  `;

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📱 WebView message:', data);
      
      if (data.type === 'loaded') {
        setLoading(false);
        setError(null);
      } else if (data.type === 'error') {
        console.error('❌ WebView error:', data.message);
        if (retryCount < maxRetries) {
          setRetryCount(retryCount + 1);
          console.log(`🔄 Retry ${retryCount + 1}/${maxRetries}`);
          setTimeout(() => {
            webViewRef.current?.reload();
          }, 2000);
        } else {
          setError(data.message);
          setLoading(false);
        }
      } else if (data.type === 'log') {
        console.log('📺 Stream:', data.message);
      }
    } catch (e) {
      console.error('Message parse error:', e);
    }
  };

  const handleRetry = () => {
    setError(null);
    setLoading(true);
    setRetryCount(0);
    webViewRef.current?.reload();
  };

  if (error && retryCount >= maxRetries) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title || channel?.name || 'Stream'}</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#e50914" />
          <Text style={styles.errorTitle}>Playback Failed</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            This stream may be offline, blocked, or incompatible with your device.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title || channel?.name || 'Stream'}</Text>
        <TouchableOpacity onPress={() => webViewRef.current?.reload()} style={styles.headerButton}>
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#e50914" />
          <Text style={styles.loadingText}>
            {retryCount > 0 ? `Retrying (${retryCount}/${maxRetries})...` : 'Loading stream...'}
          </Text>
          <Text style={styles.loadingHint}>Using WebView player</Text>
        </View>
      )}
      
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error:', nativeEvent);
          setError('WebView failed to load');
          setLoading(false);
        }}
        allowsFullscreenVideo={true}
        mixedContentMode="always"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        cacheEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 10,
  },
  headerButton: {
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingHint: {
    color: '#999',
    marginTop: 5,
    fontSize: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  errorText: {
    color: '#e50914',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 10,
  },
  errorHint: {
    color: '#999',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 25,
  },
  retryButton: {
    flexDirection: 'row',
    backgroundColor: '#e50914',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#333',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});