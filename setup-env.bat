@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"

if exist "%ROOT%backend-node\.env.example" (
  copy /Y "%ROOT%backend-node\.env.example" "%ROOT%backend-node\.env" >nul
  echo [env] backend-node/.env listo
) else (
  echo [env] backend-node/.env.example no encontrado
)

if exist "%ROOT%backend-rust\.env.example" (
  copy /Y "%ROOT%backend-rust\.env.example" "%ROOT%backend-rust\.env" >nul
  echo [env] backend-rust/.env listo
) else (
  echo [env] backend-rust/.env.example no encontrado
)

if exist "%ROOT%frontend\.env.example" (
  copy /Y "%ROOT%frontend\.env.example" "%ROOT%frontend\.env" >nul
  echo [env] frontend/.env listo
) else (
  echo [env] frontend/.env.example no encontrado
)

if exist "%ROOT%backend-go\.env.example" (
  copy /Y "%ROOT%backend-go\.env.example" "%ROOT%backend-go\.env" >nul
  echo [env] backend-go/.env listo
) else (
  echo [env] backend-go/.env.example no encontrado
)

if exist "%ROOT%storage-server\.env.example" (
  copy /Y "%ROOT%storage-server\.env.example" "%ROOT%storage-server\.env" >nul
  echo [env] storage-server/.env listo
) else (
  echo [env] storage-server/.env.example no encontrado
)

echo [env] proceso terminado
pause
