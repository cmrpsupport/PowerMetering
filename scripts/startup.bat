@echo off
:: 
:: Power Monitor - Startup script
:: Starts Node-RED backend + Vite frontend, then
:: opens the dashboard in the default browser.
:: 
setlocal

:: Resolve repo root (one level up from scripts/)
set REPO_ROOT=%~dp0..
pushd "%REPO_ROOT%"

:: Wait for network (PLC connectivity) - up to 30 seconds
echo Waiting for network...
set /a TRIES=0
:wait_net
ping -n 1 -w 1000 127.0.0.1 >nul 2>&1
if %TRIES% GEQ 6 goto net_done
timeout /t 5 /nobreak >nul
set /a TRIES+=1
goto wait_net
:net_done

echo Starting Power Monitor...

:: Start backend + frontend via npm start (concurrently)
:: Runs in foreground so the Scheduled Task keeps it alive
npm start

popd
endlocal
