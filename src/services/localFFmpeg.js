import ffmpegKit from './ffmpegKit';
import * as FileSystem from 'expo-file-system';

class LocalFFmpegService {
  async startTranscoding(proxyUrl, outputPath) {
    const finalPath = `${FileSystem.cacheDirectory}stream_${Date.now()}.ts`;
    
    const command = `-i "${proxyUrl}" -c:v libx264 -preset ultrafast -tune zerolatency -c:a aac -f mpegts "${finalPath}"`;
    
    try {
      // Try to execute
      const session = await ffmpegKit.execute(command);
      
      // Check if session has return code
      if (session && session.getReturnCode) {
        const returnCode = await session.getReturnCode();
        if (returnCode === 0) {
          return { success: true, outputPath: finalPath };
        }
      }
      
      return { success: false, error: 'Transcoding failed' };
    } catch (error) {
      console.error('FFmpeg error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async stopTranscoding() {
    // Implement if needed
  }
}

export default new LocalFFmpegService();