#!/usr/bin/env bash
# Builds a debug APK at ./BandWith-android-debug.apk.
# Remote push is switched on automatically when android/app/google-services.json
# exists (Firebase project for com.bandwith.app); without it the app skips FCM.
# Needs an arm64 JDK 17+ in JAVA_HOME and the Android SDK (ANDROID_HOME).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f android/app/google-services.json ]; then
  export VITE_ANDROID_PUSH=true
  echo "google-services.json found: Android push enabled"
else
  unset VITE_ANDROID_PUSH || true
  echo "No google-services.json: Android push disabled"
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

npm run build
npx cap sync android
# The project folder can live in iCloud Drive, which drops "file 2.xml"-style
# copies into res/ and Gradle's build dirs (Android rejects spaces in resource
# names). Build from a mirror outside iCloud and copy only the APK back.
BUILD_ROOT="${BANDWITH_ANDROID_BUILD_DIR:-$HOME/Library/Caches/bandwith-android-build}"
mkdir -p "$BUILD_ROOT"
rsync -a --delete --exclude '/app/build/' --exclude '/build/' --exclude '/.gradle/' \
  --exclude '* [0-9].*' --exclude '* [0-9][0-9].*' android/ "$BUILD_ROOT/android/"
ln -sfn "$(pwd)/node_modules" "$BUILD_ROOT/node_modules"
# Capacitor plugins are Gradle projects inside node_modules (still in iCloud);
# point their build dirs into the mirror too, and drop old in-place outputs.
find -L "$BUILD_ROOT/node_modules" -maxdepth 4 -type d -path '*/android/build' -prune -exec rm -rf {} + 2>/dev/null || true
cat >> "$BUILD_ROOT/android/build.gradle" <<'GRADLE'

// Added by scripts/build-android-apk.sh: keep plugin build outputs out of iCloud.
subprojects { p ->
    if (p.name != 'app') p.layout.buildDirectory = new File(rootDir, "build/modules/${p.name}")
}
GRADLE
(cd "$BUILD_ROOT/android" && ./gradlew assembleDebug)
cp "$BUILD_ROOT/android/app/build/outputs/apk/debug/app-debug.apk" BandWith-android-debug.apk
echo "APK: $(pwd)/BandWith-android-debug.apk"
