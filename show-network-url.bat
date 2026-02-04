@echo off
title Network IP Address
color 0E

echo ========================================
echo    Webinar Network Access URLs
echo ========================================
echo.

echo Finding your network IP address...
for /f "tokens=2 delims=[]" %%a in ('ping -4 -n 1 %ComputerName% ^| findstr "["') do set NetworkIP=%%a

echo.
echo Your Webinar Platform is accessible at:
echo ========================================
echo Local Access:     http://localhost:3000
echo Network Access:   http://%NetworkIP%:3000
echo Backend API:     http://%NetworkIP%:4000
echo ========================================
echo.
echo Share the Network Access URL with your HR manager!
echo.
echo Press any key to copy the URL to clipboard...
pause >nul

echo http://%NetworkIP%:3000 | clip
echo URL copied to clipboard! Paste it to share with others.
echo.
pause