@echo off
setlocal EnableExtensions

set "ROOT=%~dp0"

if exist "%ROOT%backend\.env.example" (
  copy /Y "%ROOT%backend\.env.example" "%ROOT%backend\.env" >nul
  echo [env] backend/.env listo
) else (
  echo [env] backend/.env.example no encontrado
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

echo [env] proceso terminado
pause
