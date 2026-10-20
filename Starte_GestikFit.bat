@echo off
title GestikFit - Gestik-Training PWA wird gestartet
chcp 65001 >nul
echo ========================================================
echo   GestikFit - Gestik-Training PWA (Hand & Arme)
echo   Gefuehrter, barrierearmer Reha-Uebungsbegleiter
echo ========================================================
echo.
echo Die App wird in Ihrem Standard-Browser geoeffnet...

cd /d "%~dp0"

:: Falls Python vorhanden ist, lokalen Webserver starten (optimal fuer PWA)
where python >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    start "GestikFit WebServer" /min python -m http.server 8000
    timeout /t 1 /nobreak >nul
    start "" "http://localhost:8000"
    exit
)

:: Direktes Oeffnen im Browser
start "" "%~dp0index.html"
exit
