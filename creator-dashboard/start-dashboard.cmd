@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERROR] Node.js / npm not found on your PATH.
  echo Install Node.js LTS from https://nodejs.org
  echo Then close and reopen this terminal, and run this file again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing dependencies ^(first run only^)...
  call npm install
  if errorlevel 1 (
    echo npm install failed. See messages above.
    pause
    exit /b 1
  )
)

echo.
echo Starting Vite. In your browser open:
echo   http://localhost:5173
echo.
echo Press Ctrl+C in this window to stop the server.
echo.
call npm run dev
pause
