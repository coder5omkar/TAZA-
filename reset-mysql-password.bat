@echo off
REM ======================================================================
REM  TAZA - local MySQL root password reset launcher
REM  Runs elevated, shows live progress, and keeps the window open at the end.
REM ======================================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Asking for administrator permission...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"

echo ============================================================
echo  TAZA - MySQL root password reset  (root  -^>  root)
echo  Script log : %TEMP%\mysql-reset-log.txt
echo  Output copy: %TEMP%\mysql-reset-console.txt
echo ============================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-mysql-password.ps1"

echo.
echo ============================================================
echo  Finished. Press any key to close this window.
echo ============================================================
pause >nul
