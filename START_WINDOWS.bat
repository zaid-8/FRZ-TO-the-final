@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. Install it, then run this file again.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if errorlevel 1 (
  echo Please update Node.js to version 22 or newer.
  pause
  exit /b 1
)
node tools\dev-server.mjs --open
if errorlevel 1 pause
endlocal
