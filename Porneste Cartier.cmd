@echo off
cd /d "%~dp0"
node.exe scripts\start.mjs --original %*
if errorlevel 1 pause
