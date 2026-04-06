Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ──────────────────────────────────────────────────
# Power Monitor — Remove all auto-start Scheduled Tasks
#
# Run as Administrator:
#   powershell -ExecutionPolicy Bypass -File scripts\autostart-uninstall.ps1
# ──────────────────────────────────────────────────

$tasks = @("PowerMonitorService", "PowerMonitorTray", "PowerMonitorAutoStart")

foreach ($name in $tasks) {
    $existing = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "Removed '$name'." -ForegroundColor Green
    }
}

Write-Host "Done — all Power Monitor auto-start tasks removed." -ForegroundColor Green
