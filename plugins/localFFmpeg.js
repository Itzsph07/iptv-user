// plugins/localFFmpeg.js — REPLACE your entire file
const { withAppBuildGradle, withProjectBuildGradle } 
  = require("@expo/config-plugins");

module.exports = function withFFmpegFix(config) {
  // Project-level build.gradle: add repos
  config = withProjectBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    
    if (!contents.includes("jitpack.io")) {
      contents = contents.replace(
        /allprojects\s*{\s*repositories\s*{/,
        `allprojects {
    repositories {
        flatDir {
            dirs project(':app').file('libs')
        }
        maven { url 'https://www.jitpack.io' }
        google()
        mavenCentral()`
      );
      cfg.modResults.contents = contents;
    }
    
    return cfg;
  });
  
  // App-level build.gradle: packagingOptions
  config = withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;
    
    if (!contents.includes("packagingOptions")) {
      contents = contents.replace(
        /android\s*{/,
        `android {
    packagingOptions {
        pickFirst '**/libc++_shared.so'
        pickFirst '**/libffmpegkit.so'
    }`
      );
    }
    
    // ⚠️ DO NOT add "configurations.all { exclude ... }" blocks!
    // ⚠️ DO NOT exclude com.arthenica modules!
    
    cfg.modResults.contents = contents;
    return cfg;
  });
  
  return config;
};