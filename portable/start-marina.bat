@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0MarinaServer.ps1" -Root "%~dp0.."
if errorlevel 1 echo Marina не запустилась. Подробности записаны в marina-server-error.txt
pause
endlocal
