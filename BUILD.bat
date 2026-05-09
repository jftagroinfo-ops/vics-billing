@echo off
chcp 65001 >nul
title SMA ERP - Build EXE for Windows
color 0A
cls

echo.
echo  ================================================
echo    SMA ERP - Production Build
echo    JFT AGRO OVERSEAS LLP
echo  ================================================
echo.

:: -------------------------------------------------------
:: STEP 1 - Check Node.js
:: -------------------------------------------------------
echo  [STEP 1/4] Checking Node.js...
echo.
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ################################################
    echo  #                                              #
    echo  #   ERROR: Node.js is NOT installed!           #
    echo  #                                              #
    echo  #   You must install Node.js first:            #
    echo  #   https://nodejs.org  (download LTS)         #
    echo  #                                              #
    echo  #   After installing, run this file again.     #
    echo  #                                              #
    echo  ################################################
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo  [OK] Node.js found: %NODE_VER%
echo.

:: -------------------------------------------------------
:: STEP 2 - Install dependencies
:: -------------------------------------------------------
echo  [STEP 2/4] Installing npm packages...
echo  (This may take 2-3 minutes on first run)
echo.
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: npm install failed.
    echo  Check your internet connection and try again.
    echo.
    pause
    exit /b 1
)
echo.
echo  [OK] Packages installed.
echo.

:: -------------------------------------------------------
:: STEP 3 - Rename vite config if wrong name
:: -------------------------------------------------------
echo  [STEP 3/4] Checking Vite config...
if exist "vite_config.js" (
    if not exist "vite.config.js" (
        echo  [FIX] Renaming vite_config.js to vite.config.js
        rename "vite_config.js" "vite.config.js"
    )
)
echo  [OK] Vite config ready.
echo.

:: -------------------------------------------------------
:: STEP 4 - Build frontend + package .exe
:: -------------------------------------------------------
echo  [STEP 4/4] Building application...
echo.

call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Vite build failed.
    echo  Check JS errors above and fix them first.
    echo.
    pause
    exit /b 1
)
echo  [OK] Frontend built.
echo.

call npm run pack-pc
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo  ERROR: Electron packager failed.
    echo  Try: npm install electron-builder --save-dev
    echo  Then run this file again.
    echo.
    pause
    exit /b 1
)

:: -------------------------------------------------------
:: SUCCESS
:: -------------------------------------------------------
color 0A
echo.
echo  ================================================
echo    BUILD COMPLETE!
echo  ================================================
echo.
echo  Your installer is ready at:
echo    SMA-ERP-PRODUCTION\
echo.
echo  Copy the Setup .exe to any Windows PC and run it.
echo.
pause
