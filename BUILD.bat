@echo off
title SMA ERP — Build .EXE for Windows
color 0A

echo.
echo  ============================================
echo   SMA ERP — Production Build
echo   JFT AGRO OVERSEAS LLP
echo  ============================================
echo.

:: ── Step 1: Check Node.js ──────────────────────────────────
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Download from: https://nodejs.org  (LTS version)
    pause
    exit /b 1
)
echo  [OK] Node.js found.

:: ── Step 2: Install dependencies ──────────────────────────
echo.
echo  Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo  [ERROR] npm install failed. Check your internet connection.
    pause
    exit /b 1
)
echo  [OK] Dependencies installed.

:: ── Step 3: Rename vite config if needed ──────────────────
if exist "vite_config.js" (
    if not exist "vite.config.js" (
        echo  [FIX] Renaming vite_config.js to vite.config.js...
        rename "vite_config.js" "vite.config.js"
        echo  [OK] Renamed.
    )
)

:: ── Step 4: Build frontend assets (Vite) ──────────────────
echo.
echo  Building frontend assets...
call npm run build
if %errorlevel% neq 0 (
    echo  [ERROR] Vite build failed. Check for JS errors in the console above.
    pause
    exit /b 1
)
echo  [OK] Frontend assets built.

:: ── Step 5: Package as Windows .exe (electron-builder) ────
echo.
echo  Packaging desktop application (.exe)...
call npm run pack-pc
if %errorlevel% neq 0 (
    echo  [ERROR] Electron packager failed.
    echo  Try running: npm install electron-builder --save-dev
    pause
    exit /b 1
)

:: ── Done ──────────────────────────────────────────────────
echo.
echo  ============================================
echo   BUILD COMPLETE
echo  ============================================
echo.
echo  Installer location:
echo    SMA-ERP-PRODUCTION\
echo.
echo  The .exe file is ready to install on any Windows PC.
echo  After installing, open the app and log in with Firebase.
echo.
pause
