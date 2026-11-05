# Quick script to build web assets, sync Capacitor, compile APK, and install to connected phone
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$ADB = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "==> [1/4] Building web assets and syncing with Capacitor..." -ForegroundColor Cyan
wsl -e bash -c "export PATH=/home/centerbe/.nvm/versions/node/v24.18.0/bin:/usr/bin:/bin:`$PATH && cd /mnt/c/Users/cente/Documents/BandWith-main && npm run build && npx cap sync android"

Write-Host "==> [2/4] Assembling Android debug APK..." -ForegroundColor Cyan
Push-Location android
try {
    .\gradlew.bat assembleDebug
} finally {
    Pop-Location
}

$apkPath = "android\app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path $apkPath)) {
    Write-Error "APK file not found at $apkPath"
    exit 1
}

Write-Host "==> [3/4] Installing APK onto connected Android device..." -ForegroundColor Cyan
& $ADB install -r $apkPath

Write-Host "==> [4/4] Launching BandWith on phone..." -ForegroundColor Cyan
& $ADB shell monkey -p com.bandwith.app -c android.intent.category.LAUNCHER 1

Write-Host "==> Success! BandWith is running on your phone." -ForegroundColor Green
