/**
 * Injected during CI after `expo prebuild`.
 * Adds a `release` signingConfig to android/app/build.gradle using brace-counting
 * (more robust than regex for Groovy DSL blocks).
 */
const fs = require('fs');
const path = require('path');

const buildGradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

if (!fs.existsSync(buildGradlePath)) {
  console.error('❌  android/app/build.gradle not found. Run expo prebuild first.');
  process.exit(1);
}

let content = fs.readFileSync(buildGradlePath, 'utf-8');

// Already patched in a previous run
if (content.includes('KEYSTORE_FILE')) {
  console.log('ℹ️   Signing config already present, skipping.');
  process.exit(0);
}

const releaseEntry = [
  '',
  '        release {',
  '            storeFile file(KEYSTORE_FILE)',
  '            storePassword KEYSTORE_PASSWORD',
  '            keyAlias KEY_ALIAS',
  '            keyPassword KEY_PASSWORD',
  '        }',
].join('\n');

// ── 1. Insert release block inside signingConfigs { … } ─────────────────────
const signingConfigsIdx = content.indexOf('signingConfigs {');

if (signingConfigsIdx === -1) {
  // No signingConfigs block — create one before buildTypes
  const buildTypesIdx = content.indexOf('    buildTypes {');
  if (buildTypesIdx === -1) {
    console.error('❌  Could not find buildTypes block in build.gradle.');
    process.exit(1);
  }
  const newBlock = `    signingConfigs {\n${releaseEntry}\n    }\n\n`;
  content = content.slice(0, buildTypesIdx) + newBlock + content.slice(buildTypesIdx);
  console.log('   → Created new signingConfigs block before buildTypes.');
} else {
  // Find the closing } of signingConfigs using brace counting
  let depth = 0;
  let closingIdx = -1;
  for (let i = signingConfigsIdx; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) { closingIdx = i; break; }
    }
  }
  if (closingIdx === -1) {
    console.error('❌  Could not find closing brace of signingConfigs block.');
    process.exit(1);
  }
  // Insert release entry just before the closing }
  content = content.slice(0, closingIdx) + releaseEntry + '\n    ' + content.slice(closingIdx);
  console.log('   → Inserted release entry into existing signingConfigs block.');
}

// ── 2. Replace signingConfig reference in release buildType ─────────────────
// Expo prebuild sets `signingConfig signingConfigs.debug` in release by default.
// We flip it to signingConfigs.release.
if (content.includes('signingConfig signingConfigs.debug')) {
  // Only replace the FIRST occurrence that belongs to the release buildType.
  // Approach: find 'release {' then replace the next signingConfig line after it.
  const releaseBuildTypeIdx = content.indexOf('        release {');
  if (releaseBuildTypeIdx !== -1) {
    const afterRelease = content.slice(releaseBuildTypeIdx);
    const patched = afterRelease.replace(
      'signingConfig signingConfigs.debug',
      'signingConfig signingConfigs.release'
    );
    content = content.slice(0, releaseBuildTypeIdx) + patched;
    console.log('   → Changed release buildType signingConfig to signingConfigs.release.');
  }
} else if (!content.includes('signingConfig signingConfigs.release')) {
  // No signingConfig line in release buildType at all — add one
  const releaseBuildTypeIdx = content.indexOf('        release {');
  if (releaseBuildTypeIdx !== -1) {
    content = content.slice(0, releaseBuildTypeIdx + '        release {'.length)
      + '\n            signingConfig signingConfigs.release'
      + content.slice(releaseBuildTypeIdx + '        release {'.length);
    console.log('   → Added signingConfig signingConfigs.release to release buildType.');
  }
}

fs.writeFileSync(buildGradlePath, content, 'utf-8');
console.log('✅  Release signing config injected into android/app/build.gradle');
