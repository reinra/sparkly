@echo off
REM Auto-update and start Sparkly
REM Downloads the latest version (if available) then launches the application.

echo === Sparkly ===
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0download-latest.ps1"

echo.
echo Starting Sparkly...
start "" "%~dp0sparkly.exe"
