@echo off
REM Check for updates and download the latest Sparkly version.
REM Does NOT start the application.

echo === Sparkly Updater ===
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0download-latest.ps1" %*

echo.
pause
