const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const rootNodeModules = path.resolve(monorepoRoot, 'node_modules');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), rootNodeModules];

// Force a single React instance (also junctioned under apps/mobile/node_modules).
config.resolver.extraNodeModules = {
  react: path.resolve(rootNodeModules, 'react'),
  'react-dom': path.resolve(rootNodeModules, 'react-dom'),
  'react-native': path.resolve(rootNodeModules, 'react-native'),
};

module.exports = withNativewind(config);
