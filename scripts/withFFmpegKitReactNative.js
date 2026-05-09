const { withProjectBuildGradle } = require('@expo/config-plugins');

module.exports = function withChadifyFFmpeg(config) {
  return withProjectBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes('ffmpegKitPackage')) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies \{/,
        `dependencies {
        implementation 'com.arthenica:ffmpeg-kit-full:6.0-2'`
      );
    }
    return config;
  });
};