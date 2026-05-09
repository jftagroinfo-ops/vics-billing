@echo off
setlocal
echo ===================================================
echo   SMA ERP - MASTER UNIFIED BUILD SYSTEM (v8.3)
echo   Ensures PC and MOBILE are synchronized
echo ===================================================
echo.

cd /d "%~dp0"

echo [0/5] Closing active instances...
taskkill /F /IM "SMA ERP.exe" /T >nul 2>&1
taskkill /F /IM "electron.exe" /T >nul 2>&1
echo System processes cleared.
timeout /t 2 /nobreak >nul

echo.
echo [1/5] Cleaning old build caches...
if exist "dist" rd /s /q "dist"
if exist "build-app" rd /s /q "build-app"
echo Cache cleared.

echo.
echo [2/5] Compiling Core Web Assets (Vite)...
cmd /c npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Web Build Failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [3/5] Syncing Assets to Android...
:: Syncing web assets from dist to capacitor android project
cmd /c npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Capacitor Sync Failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [4/5] Building PC Installer (.exe)...
cmd /c npm run pack-pc
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PC Build Failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [5/5] Building Android APK (.apk)...
cd android
cmd /c .\gradlew assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Android Build Failed!
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo.
echo ===================================================
echo   MASTER BUILD SUCCESSFUL!
echo ===================================================
echo   PC Installer:   SMA-ERP-PRODUCTION\SMA ERP Setup 8.3.0.exe
echo   Android APK:    SMA-MOBILE-BUILD\SMA_ERP_v8.3_Debug.apk
echo.
:: Ensure the APK is copied to the mobile build folder
if not exist SMA-MOBILE-BUILD mkdir SMA-MOBILE-BUILD
copy /y android\app\build\outputs\apk\debug\app-debug.apk SMA-MOBILE-BUILD\SMA_ERP_v8.3_Debug.apk >nul
echo ===================================================
pause
