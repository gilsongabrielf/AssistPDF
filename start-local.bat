@echo off
title VidaPDF Hospitalar - Servidor Local
echo ============================================================
echo   VidaPDF Hospitalar - Iniciando servidor local (porta 8000)
echo ============================================================
cd /d "%~dp0backend"
if not exist "..\frontend\dist\index.html" (
    echo Compilando interface web pela primeira vez...
    cd /d "%~dp0frontend"
    call npm run build
    cd /d "%~dp0backend"
)
echo Acesse no navegador: http://localhost:8000
echo Pressione CTRL+C para encerrar.
"%~dp0backend\.venv\Scripts\python.exe" -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
