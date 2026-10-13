@echo off
setlocal
cd /d "%~dp0"
node scripts\calculadora-launcher.cjs stop
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
exit /b 0
