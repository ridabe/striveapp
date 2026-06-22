/**
 * Injected during CI after `expo prebuild`.
 * Adds a `release` signingConfig to android/app/build.gradle
 * that reads from gradle.properties (KEYSTORE_FILE, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD).
 */
const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

if (!fs.existsSync(buildGradlePath)) {
  console.error('❌  android/app/build.gradle not found. Run expo prebuild first.');
  process.exit(1);
}

let content = fs.readFileSync(buildGradlePath, 'utf-8');

const releaseEntry = `
        release {
            storeFile file(KEYSTORE_FILE)
            storePassword KEYSTORE_PASSWORD
            keyAlias KEY_ALIAS
            keyPassword KEY_PASSWORD
        }`;

// 1. Insert release entry into signingConfigs block (or create the block)
if (!content.includes('signingConfigs {')) {
  content = content.replace(
    /(\n    buildTypes\s*\{)/,
    `\n    signingConfigs {${releaseEntry}\n    }\n$1`,
  );
} else if (!/signingConfigs\s*\{[\s\S]*?release\s*\{/.test(content)) {
  content = content.replace(
    /signingConfigs\s*\{/,
    `signingConfigs {\n${releaseEntry}`,
  );
}

// 2. Replace debug signingConfig reference inside release buildType with release
content = content.replace(
  /(buildTypes[\s\S]*?release\s*\{[\s\S]*?)signingConfig\s+signingConfigs\.debug/,
  '$1signingConfig signingConfigs.release',
);

// 3. If release buildType still has no signingConfig line, add one
if (!/release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.release/.test(content)) {
  content = content.replace(
    /(buildTypes[\s\S]*?release\s*\{)/,
    '$1\n            signingConfig signingConfigs.release',
  );
}

fs.writeFileSync(buildGradlePath, content, 'utf-8');
console.log('✅  Release signing config injected into android/app/build.gradle');
