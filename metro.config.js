const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

// Remove web from platforms to avoid web-related bundling issues
config.resolver.platforms = ['ios', 'android', 'native'];

module.exports = config;