#Requires -RunAsAdministrator
$ErrorActionPreference = "Stop"

# Power Monitor - Register auto-start on Windows
#
# Creates TWO Scheduled Tasks:
#   1. AtStartup (SYSTEM) - headless Node-RED + Vite, runs before any user logs in.
#   2. AtLogOn            - tray icon so the user can open dashboard, restart, exit.
#
# Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts\autostart-install.ps1

$ServiceTask = "PowerMonitorService"
$TrayTask    = "PowerMonitorTray"
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot    = Split-Path -Parent $ScriptDir
$StartupBat  = Join-Path $ScriptDir "startup.bat"
$TrayScript  = Join-Path $ScriptDir "tray-launcher.ps1"

foreach ($f in @($StartupBat, $TrayScript)) {
    if (-not (Test-Path $f)) { throw "Missing file: $f" }
}

# Remove previous tasks (idempotent)
foreach ($name in @($ServiceTask, $TrayTask, "PowerMonitorAutoStart")) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "Removed previous task: $name" -ForegroundColor Yellow
    }
}

# Shared settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# Task 1: Headless service at startup (runs as SYSTEM, no logon needed)
$null = Register-ScheduledTask `
    -TaskName    $ServiceTask `
    -Description "Power Monitor - headless Node-RED and Vite service" `
    -Trigger     (New-ScheduledTaskTrigger -AtStartup) `
    -Action      (New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$StartupBat`"" -WorkingDirectory $RepoRoot) `
    -Settings    $settings `
    -Principal   (New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest)

# Task 2: Tray icon at logon
$null = Register-ScheduledTask `
    -TaskName    $TrayTask `
    -Description "Power Monitor - tray icon to manage the running service" `
    -Trigger     (New-ScheduledTaskTrigger -AtLogOn) `
    -Action      (New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$TrayScript`"" -WorkingDirectory $RepoRoot) `
    -Settings    $settings

Write-Host ""
Write-Host "Installed:" -ForegroundColor Green
Write-Host "  $ServiceTask  - starts Node-RED + Vite at boot (no logon needed)"
Write-Host "  $TrayTask     - shows tray icon when a user logs in"
Write-Host ""
Write-Host "To remove: powershell -File scripts\autostart-uninstall.ps1"
