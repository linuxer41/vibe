@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"
set "LOG=%ROOT%.start.log"

mkdir "%ROOT%storage-server\media" "%ROOT%storage-server\cache" 2>nul

if exist "%LOG%" del /q "%LOG%" >nul 2>&1

echo [start] iniciando storage-server (puerto 3002)...
start "storage-server" cmd /k "cd /d "%ROOT%storage-server" && node server.js >> "%LOG%" 2>&1"

echo [start] iniciando backend Node.js (puerto 3000)...
start "backend-node" cmd /k "cd /d "%ROOT%backend" && node server.js >> "%LOG%" 2>&1"

if exist "%ROOT%backend-rust\target\release\vibe-backend-rust.exe" (
  echo [start] iniciando backend Rust (puerto 3001)...
  start "backend-rust" cmd /k "cd /d "%ROOT%backend-rust" && .\target\release\vibe-backend-rust.exe >> "%LOG%" 2>&1"
) else (
  echo [start] backend Rust no compilado, omitiendo
)

echo [start] iniciando frontend (puerto 5173)...
start "frontend" cmd /k "cd /d "%ROOT%frontend" && npx vite dev --host --port 5173 >> "%LOG%" 2>&1"

echo [start] todos los servicios lanzados. Logs: %LOG%
echo   storage-server: http://localhost:3002
echo   backend (Node): http://localhost:3000
echo   backend (Rust): http://localhost:3001
echo   frontend:       http://localhost:5173
echo [start] las ventanas de cada servicio permanecer^an abiertas
pause
