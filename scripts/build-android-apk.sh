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
(cd android && ./gradlew assembleDebug)
cp android/app/build/outputs/apk/debug/app-debug.apk BandWith-android-debug.apk
echo "APK: $(pwd)/BandWith-android-debug.apk"
