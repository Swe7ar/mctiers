@echo off
REM Starts the offline preview server for both sites.
REM   MCTiers  -> http://localhost:4173/
REM   NameMC   -> http://localhost:4173/namemc/
REM The server keeps running until you close this window (press Ctrl+C to stop).

cd /d "%~dp0"
title MCTiers offline preview

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed or not on PATH.
  echo Install it from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

echo.
echo   MCTiers   http://localhost:4173/
echo   NameMC    http://localhost:4173/namemc/
echo.
echo  Press Ctrl+C to stop the server.
echo.

node tools\serve.mjs 4173

echo.
echo Server stopped.
pause
