/**
 * Postinstall script to fix Capacitor plugin compatibility issues
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// List of plugins that need proguard fix
const pluginsToFix = [
  'node_modules/@capacitor/app/android/build.gradle',
  'node_modules/@aparajita/capacitor-biometric-auth/android/build.gradle',
];

pluginsToFix.forEach(pluginPath => {
  const fullPath = join(rootDir, pluginPath);
  
  if (existsSync(fullPath)) {
    let content = readFileSync(fullPath, 'utf8');
    
    if (content.includes("proguard-android.txt")) {
      content = content.replace(
        /getDefaultProguardFile\('proguard-android\.txt'\)/g,
        "getDefaultProguardFile('proguard-android-optimize.txt')"
      );
      writeFileSync(fullPath, content);
      console.log(`✓ Fixed proguard in ${pluginPath}`);
    } else {
      console.log(`✓ Proguard already fixed in ${pluginPath}`);
    }
  } else {
    console.log(`⚠ ${pluginPath} not found, skipping`);
  }
});
