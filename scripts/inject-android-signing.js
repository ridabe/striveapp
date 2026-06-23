/**
 * Injected during CI after `expo prebuild`.
 * Adds signingConfigs.release and wires it into buildTypes.release.
 *
 * Robust approach:
 *  - Uses brace-counting to isolate the buildTypes block before any replacement
 *  - This prevents accidentally modifying the signingConfigs.release block
 *    (which is inserted before buildTypes and also contains a `release {` token)
 */
const fs = require('fs');
const path = require('path');

const gradlePath = path.join(process.cwd(), 'android', 'app', 'build.gradle');

if (!fs.existsSync(gradlePath)) {
  console.error('❌  android/app/build.gradle not found. Run expo prebuild first.');
  process.exit(1);
}

let src = fs.readFileSync(gradlePath, 'utf-8');

// ── 1. Insert signingConfigs block before buildTypes (idempotent) ─────────────
if (src.includes('KEYSTORE_FILE')) {
  console.log('ℹ️   signingConfigs block already present, skipping insertion.');
} else {
  const signingBlock = [
    '    signingConfigs {',
    '        release {',
    '            storeFile file(KEYSTORE_FILE)',
    '            storePassword KEYSTORE_PASSWORD',
    '            keyAlias KEY_ALIAS',
    '            keyPassword KEY_PASSWORD',
    '        }',
    '    }',
    '',
  ].join('\n');

  // Find buildTypes using regex so indentation doesn't matter
  const btRegex = /[ \t]*buildTypes\s*\{/;
  if (!btRegex.test(src)) {
    console.error('❌  Could not find buildTypes block in build.gradle.');
    process.exit(1);
  }
  src = src.replace(btRegex, (match) => signingBlock + match);
  console.log('   → Inserted signingConfigs block before buildTypes.');
}

// ── 2. Fix signingConfig ONLY inside the buildTypes block ─────────────────────
// Use brace-counting to extract exactly the buildTypes block, then operate inside it.
const btMatch = /buildTypes\s*\{/.exec(src);
if (!btMatch) {
  console.error('❌  Could not locate buildTypes block for signingConfig fix.');
  process.exit(1);
}

const btStart = btMatch.index;
let depth = 0;
let btEnd = -1;
for (let i = btStart; i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') {
    depth--;
    if (depth === 0) { btEnd = i; break; }
  }
}

if (btEnd === -1) {
  console.error('❌  Could not find closing brace of buildTypes block.');
  process.exit(1);
}

let btContent = src.slice(btStart, btEnd + 1);

if (btContent.includes('signingConfig signingConfigs.release')) {
  console.log('ℹ️   buildTypes.release already uses signingConfigs.release.');
} else if (btContent.includes('signingConfig signingConfigs.debug')) {
  // Replace debug → release (only first occurrence, which is inside release buildType)
  btContent = btContent.replace(
    'signingConfig signingConfigs.debug',
    'signingConfig signingConfigs.release',
  );
  console.log('   → Replaced signingConfigs.debug → signingConfigs.release in buildTypes.release.');
} else {
  // No signingConfig line at all — inject one right after `release {`
  const releaseBlockMatch = /([ \t]*release\s*\{)/.exec(btContent);
  if (releaseBlockMatch) {
    btContent = btContent.replace(
      releaseBlockMatch[0],
      releaseBlockMatch[0] + '\n            signingConfig signingConfigs.release',
    );
    console.log('   → Injected signingConfig signingConfigs.release into buildTypes.release.');
  } else {
    console.warn('⚠️   Could not find release buildType. Signing may not be applied.');
  }
}

src = src.slice(0, btStart) + btContent + src.slice(btEnd + 1);

fs.writeFileSync(gradlePath, src, 'utf-8');
console.log('✅  Release signing config injected into android/app/build.gradle');
