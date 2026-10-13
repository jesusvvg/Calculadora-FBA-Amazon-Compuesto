@echo off
setlocal
cd /d "%~dp0"
node scripts\calculadora-launcher.cjs update
if errorlevel 1 (
  echo.
  pause
  exit /b 1
)
echo.
pause
exit /b 0
