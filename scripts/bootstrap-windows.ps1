Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Missing required command: $name. Install it and re-run."
  }
}

Write-Host "== PowerMetering bootstrap (Windows) ==" -ForegroundColor Cyan

Assert-Command "node"
Assert-Command "npm"

$nodeVer = (node -v)
Write-Host "Node: $nodeVer"

# Ensure we are running from repo root (package.json present)
if (-not (Test-Path -Path ".\package.json")) {
  throw "Run this from the repo root (folder containing package.json)."
}

# Create .env if missing (safe defaults; user can edit later)
if (-not (Test-Path -Path ".\.env")) {
  @"
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://127.0.0.1:1880
"@ | Out-File -FilePath ".\.env" -Encoding utf8
  Write-Host "Created .env"
} else {
  Write-Host ".env exists (not modifying)."
}

Write-Host "Installing frontend deps..." -ForegroundColor Cyan
npm install

Write-Host "Installing backend (Node-RED) deps..." -ForegroundColor Cyan
npm install --prefix backend

Write-Host "Starting frontend + backend..." -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5173"
Write-Host "Node-RED: http://localhost:1880"
npm start

