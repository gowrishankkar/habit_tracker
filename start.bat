@echo off
setlocal enabledelayedexpansion

echo.
echo ============================================================
echo   Habit Tracker — Dev Startup
echo   Database: MongoDB Atlas (cloud)
echo ============================================================
echo.

:: ── Step 1: Run any pending setup scripts ────────────────────
if exist "create-analytics-module.cjs" (
    echo [setup] Creating analytics module...
    node create-analytics-module.cjs
)
if exist "setup-tests.cjs" (
    echo [setup] Creating test infrastructure...
    node setup-tests.cjs
)
echo.

:: ── Step 2: Install dependencies ─────────────────────────────
echo [1/2] Installing dependencies...
call npm install
if !errorlevel! neq 0 (
    echo ERROR: npm install failed. Check your Node version (need 20+).
    pause
    exit /b 1
)
echo     Done.
echo.

:: ── Step 3: Start API + Web in separate windows ───────────────
echo [2/2] Starting API (port 4000) and Web (port 5173)...
echo.

start "Habit Tracker — API" cmd /k "cd /d "%~dp0" && npm run dev:api"
timeout /t 3 /nobreak >nul
start "Habit Tracker — Web" cmd /k "cd /d "%~dp0" && npm run dev:web"

echo.
echo ============================================================
echo   API  →  http://localhost:4000/api/health
echo   Web  →  http://localhost:5173
echo ============================================================
echo.
echo Both servers are running in separate windows.
echo Close those windows to stop the servers.
echo.
pause
