@echo off
title Webinar Platform - Network Access
color 0A

echo ========================================
echo    Webinar Platform - Network Setup
echo ========================================
echo.

echo Starting backend server...
cd backend
start "Backend Server" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo Starting frontend server...
cd ../frontend
start "Frontend Server" cmd /k "npm run dev"

echo.
echo ========================================
echo    Setup Complete!
echo ========================================
echo.
echo Your HR manager can access the webinar at:
echo.
echo    http://192.168.1.43:3000
echo.
echo Backend API is available at:
echo    http://192.168.1.43:4000
echo.
echo Press any key to close this window...
pause >nul