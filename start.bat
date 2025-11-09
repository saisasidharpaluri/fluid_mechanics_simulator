@echo off
echo ========================================
echo  3D Fluid Simulator - Quick Launcher
echo ========================================
echo.
echo Starting local web server...
echo.
echo Once the server starts, open your browser to:
echo http://localhost:8000
echo.
echo Press Ctrl+C to stop the server
echo.
echo ========================================
echo.

python -m http.server 8000
