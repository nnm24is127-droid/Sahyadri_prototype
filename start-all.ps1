# FarmConnect AI - Windows PowerShell One-Click Launcher
Write-Host "===================================================" -ForegroundColor Green
Write-Host "Starting FarmConnect AI Services" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Green

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Start Blockchain Node
Write-Host "[1/3] Starting Hardhat EVM Blockchain Node..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\blockchain'; npx hardhat node"

Start-Sleep -Seconds 4

# Deploy contracts
Write-Host "Deploying Smart Contracts to Local Node..." -ForegroundColor Yellow
Set-Location "$Root\blockchain"
npx hardhat run scripts/deploy.js --network localhost

# 2. Start FastAPI Backend
Write-Host "[2/3] Starting FastAPI Backend on Port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\backend'; uvicorn app.main:app --reload --port 8000"

Start-Sleep -Seconds 2

# 3. Start React Frontend
Write-Host "[3/3] Starting React Frontend on Port 5173..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend'; npm run dev"

Write-Host "===================================================" -ForegroundColor Green
Write-Host "All FarmConnect AI services are running!" -ForegroundColor Green
Write-Host "Frontend:   http://localhost:5173" -ForegroundColor Cyan
Write-Host "Backend:    http://localhost:8000/api/v1/docs" -ForegroundColor Cyan
Write-Host "Blockchain: http://localhost:8545" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Green
