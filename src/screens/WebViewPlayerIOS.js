// WebViewPlayerIOS.js - iOS-specific player using WebView with video.js
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';

export default function WebViewPlayerIOS({ route, navigation }) {
  useKeepAwake();
  
  const { url, title, channel } = route.params; // Added channel param
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [proxiedUrl, setProxiedUrl] = useState(null);

  useEffect(() => {
    console.log('🍎 iOS WebView Player initialized');
    console.log('Stream URL:', url);
    console.log('Title:', title);
    
    // Use proxy for better compatibility
    const proxyUrl = generateProxyUrl(url, channel);
    console.log('Proxied URL:', proxyUrl);
    setProxiedUrl(proxyUrl);
  }, []);

  const generateProxyUrl = (streamUrl, channelData) => {
    // Extract MAC from URL or channel data
    const macMatch = streamUrl.match(/mac=([^&]+)/);
    const mac = macMatch ? macMatch[1] : (channelData?.macAddress || '00:1A:79:00:00:00');
    
    // Use backend proxy which has MAG headers
    const proxy = `http://192.168.100.229:5000/api/proxy/stream?url=${encodeURIComponent(streamUrl)}&mac=${encodeURIComponent(mac)}`;
    return proxy;
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleRetry = () => {
    setRetryCount(retryCount + 1);
    setError(null);
    setLoading(true);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const handleWebViewError = (syntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setError('Failed to load stream in WebView player');
    setLoading(false);
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Message from WebView:', data);
      
      if (data.type === 'error') {
        setError(data.message || 'Playback error occurred');
        setLoading(false);
      } else if (data.type === 'loaded') {
        setLoading(false);
        setError(null);
      } else if (data.type === 'playing') {
        setLoading(false);
      }
    } catch (err) {
      console.log('Message parse error:', err);
    }
  };

  // HTML with native iOS video player (simpler, works better for proxied streams)
  const generateHTML = () => {
    const finalUrl = proxiedUrl || url;
    
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title || 'IPTV Player'}</title>
  
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-user-select: none;
      user-select: none;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #000;
      position: fixed;
    }
    
    #video-container {
      width: 100%;
      height: 100%;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    video {
      width: 100%;
      height: 100%;
      object-fit: contain;
      background: #000;
    }
    
    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: #fff;
      font-size: 16px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      text-align: center;
      z-index: 10;
      pointer-events: none;
    }
    
    .spinner {
      border: 3px solid rgba(255, 255, 255, 0.3);
      border-top: 3px solid #fff;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 0 auto 12px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .error-msg {
      color: #e50914;
      margin-top: 10px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="video-container">
    <video 
      id="player" 
      controls 
      autoplay 
      playsinline
      webkit-playsinline
      x-webkit-airplay="allow"
      preload="auto"
    ></video>
    
    <div id="loading">
      <div class="spinner"></div>
      <div id="loading-text">Connecting via proxy...</div>
      <div id="error-text" class="error-msg" style="display: none;"></div>
    </div>
  </div>
  
  <script>
    const streamUrl = ${JSON.stringify(finalUrl)};
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loading-text');
    const errorText = document.getElementById('error-text');
    const video = document.getElementById('player');
    
    let retryCount = 0;
    const maxRetries = 3;
    
    function sendMessage(type, message) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, message }));
      }
    }
    
    function hideLoading() {
      if (loading) {
        loading.style.display = 'none';
      }
    }
    
    function showLoading(text) {
      if (loading) {
        loading.style.display = 'block';
        if (text && loadingText) {
          loadingText.textContent = text;
        }
      }
    }
    
    function showError(text) {
      if (errorText) {
        errorText.textContent = text;
        errorText.style.display = 'block';
      }
      if (loadingText) {
        loadingText.style.display = 'none';
      }
    }
    
    // Try to load the stream
    function loadStream(sourceUrl) {
      console.log('Loading stream:', sourceUrl);
      
      try {
        video.src = sourceUrl;
        video.load();
      } catch (err) {
        console.error('Load error:', err);
        showError('Failed to load stream');
        sendMessage('error', 'Load failed: ' + err.message);
      }
    }
    
    // Event listeners
    video.addEventListener('loadstart', function() {
      console.log('Video load started');
      showLoading('Connecting...');
    });
    
    video.addEventListener('loadedmetadata', function() {
      console.log('Metadata loaded');
      showLoading('Buffering...');
    });
    
    video.addEventListener('loadeddata', function() {
      console.log('Data loaded');
    });
    
    video.addEventListener('canplay', function() {
      console.log('Can play');
      hideLoading();
    });
    
    video.addEventListener('playing', function() {
      console.log('Video playing');
      hideLoading();
      sendMessage('playing', 'Stream is playing');
    });
    
    video.addEventListener('play', function() {
      console.log('Play event');
      hideLoading();
      sendMessage('loaded', 'Stream loaded');
    });
    
    video.addEventListener('waiting', function() {
      console.log('Video buffering');
      showLoading('Buffering...');
    });
    
    video.addEventListener('stalled', function() {
      console.log('Video stalled');
      showLoading('Connection slow...');
    });
    
    video.addEventListener('error', function(e) {
      console.error('Video error event:', e);
      console.error('Video error object:', video.error);
      console.error('Video network state:', video.networkState);
      console.error('Video ready state:', video.readyState);
      console.error('Video current src:', video.currentSrc);
      
      const error = video.error;
      let errorMsg = 'Playback error';
      let shouldRetry = false;
      
      if (error) {
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        switch(error.code) {
          case 1: // MEDIA_ERR_ABORTED
            errorMsg = 'Playback aborted';
            break;
            
          case 2: // MEDIA_ERR_NETWORK
            errorMsg = 'Network error - Check backend proxy';
            shouldRetry = true;
            break;
            
          case 3: // MEDIA_ERR_DECODE
            errorMsg = 'Decode error - Stream format issue';
            break;
            
          case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
            errorMsg = 'Format not supported - Backend may not be streaming correctly';
            // Try retry once for format issues (might be temporary)
            shouldRetry = retryCount === 0;
            break;
            
          default:
            errorMsg = 'Unknown error: ' + error.code;
        }
      }
      
      // Retry logic
      if (shouldRetry && retryCount < maxRetries) {
        retryCount++;
        showLoading('Retrying... (' + retryCount + '/' + maxRetries + ')');
        console.log('Retrying stream load, attempt:', retryCount);
        setTimeout(() => {
          loadStream(streamUrl);
        }, 2000);
        return;
      }
      
      // Show error
      showError(errorMsg);
      sendMessage('error', errorMsg);
    });
    
    video.addEventListener('pause', function() {
      console.log('Video paused');
    });
    
    video.addEventListener('ended', function() {
      console.log('Video ended (live streams should not end)');
      showLoading('Stream ended, reconnecting...');
      setTimeout(() => {
        loadStream(streamUrl);
      }, 2000);
    });
    
    // Handle visibility changes
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        console.log('Page hidden');
      } else {
        console.log('Page visible');
        if (video.paused && !video.ended) {
          video.play().catch(err => {
            console.log('Resume play error:', err);
          });
        }
      }
    });
    
    // Prevent double-tap zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', function(event) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        event.preventDefault();
      }
      lastTouchEnd = now;
    }, false);
    
    // Prevent context menu
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    });
    
    // Start loading
    console.log('Starting stream load via proxy...');
    loadStream(streamUrl);
    
    // Auto-play after a short delay (helps with some streams)
    setTimeout(() => {
      if (video.paused) {
        video.play().catch(err => {
          console.log('Auto-play error:', err);
          // Don't show error, user can tap to play
        });
      }
    }, 1000);
    
  </script>
</body>
</html>
    `;
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title || 'IPTV Player'}
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={60} color="#e50914" />
          <Text style={styles.errorTitle}>iOS Playback Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          
          <View style={styles.errorButtons}>
            <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#fff" />
              <Text style={styles.buttonText}>Retry</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.backButtonError} onPress={handleBack}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
              <Text style={styles.buttonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title || 'IPTV Player'}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: generateHTML() }}
          style={styles.webView}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false}
          onError={handleWebViewError}
          onMessage={handleMessage}
          allowsFullscreenVideo={true}
          bounces={false}
          scrollEnabled={false}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('HTTP error:', nativeEvent.statusCode);
            if (nativeEvent.statusCode === 401) {
              setError('Unauthorized (401): Stream requires valid credentials');
              setLoading(false);
            }
          }}
        />
        
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.loadingText}>
              Loading stream...
            </Text>
            <Text style={styles.loadingSubtext}>
              iOS WebView Player
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
  },
  loadingSubtext: {
    color: '#4CAF50',
    marginTop: 5,
    fontSize: 13,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 15,
  },
  errorText: {
    color: '#999',
    fontSize: 15,
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  errorButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 10,
  },
  retryButton: {
    backgroundColor: '#e50914',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 5,
  },
  backButtonError: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});