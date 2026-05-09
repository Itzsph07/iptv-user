// plugins/with-ffmpeg-fix.js
const { withAppBuildGradle, withProjectBuildGradle } = require("@expo/config-plugins");

module.exports = function withFFmpegFix(config) {
  // Modify project-level build.gradle
  config = withProjectBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    
    // Add repositories
    if (!contents.includes("flatDir")) {
      contents = contents.replace(
        /allprojects\s*{\s*repositories\s*{/,
        `allprojects {\n    repositories {\n        flatDir {\n            dirs project(':app').file('libs')\n        }\n        maven { url 'https://www.jitpack.io' }\n        mavenCentral()\n        google()`
      );
      cfg.modResults.contents = contents;
    }
    
    return cfg;
  });
  
  // Modify app/build.gradle to exclude broken dependencies
  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    
    // Add packagingOptions
    if (!contents.includes("packagingOptions")) {
      contents = contents.replace(
        /android\s*{/,
        `android {\n    packagingOptions {\n        pickFirst '**/libc++_shared.so'\n        pickFirst '**/libjsc.so'\n    }`
      );
    }
    
    // Add configuration to exclude broken FFmpeg dependencies
    const excludeConfig = `
// Force exclude broken FFmpegKit dependencies
configurations.all {
    exclude group: 'com.arthenica', module: 'ffmpeg-kit-https'
    exclude group: 'com.arthenica', module: 'mobile-ffmpeg-https'
    exclude group: 'com.arthenica', module: 'ffmpeg-kit-min'
    exclude group: 'com.arthenica', module: 'ffmpeg-kit-full'
}
`;
    
    if (!contents.includes("configurations.all")) {
      contents = contents.replace(
        /android\s*{/,
        `${excludeConfig}\n\nandroid {`
      );
    }
    
    cfg.modResults.contents = contents;
    return cfg;
  });
  
  return config;
};