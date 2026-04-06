$ErrorActionPreference = "Stop"

# ──────────────────────────────────────────────────
# Power Monitor - Register auto-start on Windows
#
# Creates TWO Scheduled Tasks:
#   1. AtStartup  (SYSTEM) - headless Node-RED + Vite,
#      runs before anyone logs in.
#   2. AtLogOn - tray icon so the user can open the
#      dashboard, restart, or exit.
#
# Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts\autostart-install.ps1
# ──────────────────────────────────────────────────

$ServiceTask = "PowerMonitorService"
$TrayTask    = "PowerMonitorTray"
$ScriptDir   = Split-Path -Parent $MyInvocation.MyCommand.Definition
$RepoRoot    = Split-Path -Parent $ScriptDir
$StartupBat  = Join-Path $ScriptDir "startup.bat"
$TrayScript  = Join-Path $ScriptDir "tray-launcher.ps1"

foreach ($f in @($StartupBat, $TrayScript)) {
    if (-not (Test-Path $f)) { throw "Missing: $f" }
}

# ── Remove previous tasks (idempotent) ────────────
foreach ($name in @($ServiceTask, $TrayTask, "PowerMonitorAutoStart")) {
    $existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "Removed previous '$name' task." -ForegroundColor Yellow
    }
}

# ── Shared settings ───────────────────────────────
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

# ── Task 1: Headless service at startup ───────────
$svcTrigger   = New-ScheduledTaskTrigger -AtStartup
$svcAction    = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$StartupBat`"" `
    -WorkingDirectory $RepoRoot
$svcPrincipal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName $ServiceTask `
    -Trigger $svcTrigger `
    -Action $svcAction `
    -Settings $settings `
    -Principal $svcPrincipal `
    -Description "Power Monitor headless service (Node-RED + Vite) - runs at boot" | Out-Null

# ── Task 2: Tray icon at logon ────────────────────
$trayTrigger = New-ScheduledTaskTrigger -AtLogOn
$trayAction  = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$TrayScript`"" `
    -WorkingDirectory $RepoRoot

Register-ScheduledTask `
    -TaskName $TrayTask `
    -Trigger $trayTrigger `
    -Action $trayAction `
    -Settings $settings `
    -Description "Power Monitor tray icon - manage the running service" | Out-Null

Write-Host ""
Write-Host "Installed two scheduled tasks:" -ForegroundColor Green
Write-Host "  $ServiceTask  - starts Node-RED + Vite at boot (no logon needed)"
Write-Host "  $TrayTask     - shows tray icon when a user logs in"
Write-Host ""
Write-Host "To remove:  powershell -File scripts\autostart-uninstall.ps1"
