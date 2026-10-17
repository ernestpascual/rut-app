const { withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const plistModule = require('@expo/plist');
const plist = plistModule.default || plistModule;

function withShareExtensionDisplayName(config, displayName = 'rut') {
  return withXcodeProject(config, async (config) => {
    const platformProjectRoot = config.modRequest.platformProjectRoot;
    const infoPlistPath = path.join(
      platformProjectRoot,
      'ShareExtension',
      'ShareExtension-Info.plist'
    );
    if (fs.existsSync(infoPlistPath)) {
      try {
        const content = fs.readFileSync(infoPlistPath, 'utf8');
        const parsed = plist.parse(content);
        parsed.CFBundleDisplayName = displayName;
        fs.writeFileSync(infoPlistPath, plist.build(parsed));
      } catch (e) {
        console.warn('[withShareExtensionDisplayName] failed to update plist:', e);
      }
    }
    return config;
  });
}

module.exports = withShareExtensionDisplayName;
