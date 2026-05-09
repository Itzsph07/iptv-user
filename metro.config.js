// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Force disable Fabric/new architecture
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Add resolver for TV
config.resolver = {
  ...config.resolver,
  platforms: ['android', 'ios', 'web', 'tv'],
};

module.exports = config;