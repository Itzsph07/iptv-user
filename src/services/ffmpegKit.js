import { NativeModules } from 'react-native';

// Log ALL native modules to see what's available
console.log('🔍 === ALL NATIVE MODULES ===');
const allModules = Object.keys(NativeModules);
console.log('Total:', allModules.length);
allModules.forEach(key => {
  console.log('  📦', key);
});

// Look for ANY module that might be FFmpeg
const possibleModules = allModules.filter(key => 
  key.toLowerCase().includes('ffmpeg') || 
  key.toLowerCase().includes('arthenica') ||
  key.toLowerCase().includes('ffmpegkit') ||
  key === 'FFmpegKitReactNativeModule'
);
console.log('🎬 Potential FFmpeg modules:', possibleModules);

// Try to get the module by different possible names
const FFmpegModule = NativeModules.FFmpegKitReactNativeModule || 
                     NativeModules.FFmpegKitModule ||
                     NativeModules.RCTFFmpegKit ||
                     NativeModules.FFmpegKit;

if (!FFmpegModule) {
  console.error('❌ NO FFMPEG MODULE FOUND!');
  console.log('Available modules starting with R', allModules.filter(k => k.startsWith('R')).slice(0, 20));
}

export default FFmpegModule;