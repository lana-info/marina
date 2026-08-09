@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MarinaServer.ps1" -Root "%~dp0.."
endlocal
