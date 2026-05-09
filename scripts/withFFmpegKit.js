const { withDangerousMod, withPlugins } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withFFmpegKit(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        'build.gradle'
      );
      
      let content = fs.readFileSync(buildGradlePath, 'utf-8');
      
      // Inject FFmpeg Kit dependency
      if (!content.includes('ffmpeg-kit-full')) {
        const dependencyBlock = `
ext {
    ffmpegKitPackage = "full"
}

allprojects {
    repositories {
        maven { url 'https://raw.githubusercontent.com/arthenica/maven-repository/main' }
    }
}`;
        content = dependencyBlock + '\n' + content;
        fs.writeFileSync(buildGradlePath, content);
      }
      
      return config;
    },
  ]);
};