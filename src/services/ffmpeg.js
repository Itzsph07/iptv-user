import { NativeModules } from 'react-native';

const { FFmpegKitReactNativeModule } = NativeModules;

export default {
  execute: async (command) => {
    // Split command into arguments
    const args = command.split(' ');
    const sessionId = await FFmpegKitReactNativeModule.ffmpegSession(args);
    await FFmpegKitReactNativeModule.asyncFFmpegSessionExecute(sessionId);
    
    // Wait a bit for completion (simplified)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const returnCode = await FFmpegKitReactNativeModule.abstractSessionGetReturnCode(sessionId);
    const logs = await FFmpegKitReactNativeModule.abstractSessionGetAllLogs(sessionId);
    
    return {
      getReturnCode: () => ({ getValue: () => returnCode, isValueSuccess: () => returnCode === 0 }),
      getOutput: () => logs.join('\n')
    };
  }
};