@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MarinaServer.ps1" -Root "%~dp0.."
if errorlevel 1 echo Marina did not start. Details are in marina-server-error.txt
pause
endlocal
