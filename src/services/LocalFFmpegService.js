// services/LocalFFmpegService.js
import { NativeModules, DeviceEventEmitter } from 'react-native';

const { FFmpegKitReactNativeModule } = NativeModules;

class LocalFFmpegService {
  /**
   * Executes an FFmpeg command and returns a promise.
   * @param {string} command - Full FFmpeg command string
   * @returns {Promise<{returnCode: number, output: string}>}
   */
  execute(command) {
    return new Promise((resolve, reject) => {
      const args = command.split(' ').filter(a => a.length > 0);

      FFmpegKitReactNativeModule.ffmpegSession(args)
        .then(sessionMap => {
          const sessionId = sessionMap.sessionId;

          // Listen for completion event from native side
          const subscription = DeviceEventEmitter.addListener(
            'FFmpegKitCompleteCallbackEvent',
            (completedSession) => {
              if (completedSession.sessionId !== sessionId) return;
              subscription.remove();

              FFmpegKitReactNativeModule.abstractSessionGetReturnCode(sessionId)
                .then(returnCode => {
                  resolve({
                    returnCode,
                    output: completedSession.logs?.join('\n') || ''
                  });
                })
                .catch(reject);
            }
          );

          // Start execution
          FFmpegKitReactNativeModule.asyncFFmpegSessionExecute(sessionId)
            .catch(reject);
        })
        .catch(reject);
    });
  }

  async executeWithArguments(argsArray) {
    return new Promise((resolve, reject) => {
      FFmpegKitReactNativeModule.ffmpegSession(argsArray)
        .then(sessionMap => {
          const sessionId = sessionMap.sessionId;

          const subscription = DeviceEventEmitter.addListener(
            'FFmpegKitCompleteCallbackEvent',
            (completedSession) => {
              if (completedSession.sessionId !== sessionId) return;
              subscription.remove();

              FFmpegKitReactNativeModule.abstractSessionGetReturnCode(sessionId)
                .then(returnCode => {
                  resolve({
                    returnCode,
                    output: completedSession.logs?.join('\n') || ''
                  });
                })
                .catch(reject);
            }
          );

          FFmpegKitReactNativeModule.asyncFFmpegSessionExecute(sessionId)
            .catch(reject);
        })
        .catch(reject);
    });
  }

  async startTranscoding(proxyUrl, outputPath) {
    const command = `-y -i "${proxyUrl}" -c:v libx264 -preset ultrafast -tune zerolatency -c:a aac -f mpegts "${outputPath}"`;
    console.log('🎬 Executing:', command);

    try {
      const result = await this.execute(command);

      if (result.returnCode === 0) {
        return { success: true, outputPath };
      } else {
        throw new Error(`FFmpeg failed with rc=${result.returnCode}`);
      }
    } catch (error) {
      console.error('❌ FFmpeg error:', error);
      return { success: false, error: error.message };
    }
  }

  async stopTranscoding() {
    console.log('🛑 Stopping transcoding');
    // For now - full implementation would track active session IDs
    // and call FFmpegKit.cancel(sessionId) via native module
  }
}

export default new LocalFFmpegService();