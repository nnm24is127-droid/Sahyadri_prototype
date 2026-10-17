@echo off
TITLE FarmConnect AI Launcher
echo ===================================================
echo Starting FarmConnect AI Services (Local Dev Mode)
echo ===================================================

echo [1/3] Launching Hardhat Local EVM Node...
start "FarmConnect Blockchain Node" cmd /k "cd /d %~dp0blockchain && npx hardhat node"

timeout /t 4 /nobreak >nul

echo [2/3] Deploying Smart Contracts to Local Node...
cd /d %~dp0blockchain && call npx hardhat run scripts/deploy.js --network localhost

echo [3/3] Launching FastAPI Backend Server...
start "FarmConnect Backend" cmd /k "cd /d %~dp0backend && uvicorn app.main:app --reload --port 8000"

timeout /t 2 /nobreak >nul

echo Launching React Frontend (Vite)...
start "FarmConnect Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo ===================================================
echo All services launched!
echo - Frontend:   http://localhost:5173
echo - Backend:    http://localhost:8000/api/v1/docs
echo - Blockchain: http://localhost:8545
echo ===================================================
pause
