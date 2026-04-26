@echo off
echo =========================================
echo   SecureApp - Setup Script
echo =========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo X Node.js is not installed. Please install Node.js first.
    echo    Visit: https://nodejs.org/
    pause
    exit /b 1
)

echo OK Node.js version: 
node --version
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

if %errorlevel% equ 0 (
    echo.
    echo =========================================
    echo   OK Setup Complete!
    echo =========================================
    echo.
    echo To start the application:
    echo   npm start
    echo.
    echo Then open your browser to:
    echo   http://localhost:3000
    echo.
    echo Demo Credentials:
    echo   Username: admin ^| Password: admin123
    echo   Username: user  ^| Password: user123
    echo   Username: demo  ^| Password: demo123
    echo.
    echo =========================================
) else (
    echo.
    echo X Installation failed. Please check the error messages above.
    pause
    exit /b 1
)

pause
