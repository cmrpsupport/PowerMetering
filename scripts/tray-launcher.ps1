# 
# Power Monitor - System-tray launcher
# Starts the app hidden and places an icon in the
# notification area. No console window to close.
# 
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)

#  helper: check if the service is already running 
function Test-ServiceRunning {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 1880)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

#  helper: start npm hidden 
function Start-PowerMonitor {
    if (Test-ServiceRunning) {
        # Service task already started it at boot - nothing to do
        $script:ManagedByUs = $false
        return
    }
    $si = New-Object System.Diagnostics.ProcessStartInfo
    $si.FileName        = "cmd.exe"
    $si.Arguments       = "/c npm start"
    $si.WorkingDirectory = $RepoRoot
    $si.WindowStyle     = [System.Diagnostics.ProcessWindowStyle]::Hidden
    $si.CreateNoWindow  = $true
    $si.UseShellExecute = $false
    $script:AppProcess  = [System.Diagnostics.Process]::Start($si)
    $script:ManagedByUs = $true
}

#  helper: stop process tree 
function Stop-PowerMonitor {
    if ($script:ManagedByUs -and $script:AppProcess -and -not $script:AppProcess.HasExited) {
        # /T kills entire child-process tree (concurrently, node-red, vite)
        Start-Process "taskkill" -ArgumentList "/F /T /PID $($script:AppProcess.Id)" `
            -NoNewWindow -Wait -ErrorAction SilentlyContinue
    }
}

#  build a simple  icon 
function New-TrayIcon {
    $bmp = New-Object System.Drawing.Bitmap(16, 16)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::FromArgb(30, 120, 230))
    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $font  = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $g.DrawString("P", $font, $brush, 1, 0)
    $g.Dispose()
    $icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
    return $icon
}

#  tray icon + context menu 
$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon    = New-TrayIcon
$notify.Text    = "Power Monitor"
$notify.Visible = $true

$menu = New-Object System.Windows.Forms.ContextMenuStrip

# Open Dashboard
$openItem = New-Object System.Windows.Forms.ToolStripMenuItem("Open Dashboard")
$openItem.Add_Click({ Start-Process "http://localhost:5173" })
$menu.Items.Add($openItem) | Out-Null

# Separator
$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Restart
$restartItem = New-Object System.Windows.Forms.ToolStripMenuItem("Restart")
$restartItem.Add_Click({
    $notify.Text = "Power Monitor - restarting..."
    Stop-PowerMonitor
    Start-Sleep -Seconds 2
    Start-PowerMonitor
    $notify.Text = "Power Monitor"
    $notify.ShowBalloonTip(3000, "Power Monitor", "Services restarted.", [System.Windows.Forms.ToolTipIcon]::Info)
})
$menu.Items.Add($restartItem) | Out-Null

# Exit
$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem("Exit")
$exitItem.Add_Click({
    Stop-PowerMonitor
    $notify.Visible = $false
    $notify.Dispose()
    [System.Windows.Forms.Application]::Exit()
})
$menu.Items.Add($exitItem) | Out-Null

$notify.ContextMenuStrip = $menu

# Double-click tray icon  open dashboard
$notify.Add_DoubleClick({ Start-Process "http://localhost:5173" })

#  start the app and enter message loop
Start-PowerMonitor

# Auto-open dashboard once the frontend is ready
Start-Job -ScriptBlock {
    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect("127.0.0.1", 5173)
            $tcp.Close()
            Start-Process "http://localhost:5173"
            break
        } catch {
            Start-Sleep -Seconds 2
        }
    }
} | Out-Null

$notify.ShowBalloonTip(3000, "Power Monitor", "Running in background. Right-click tray icon for options.", [System.Windows.Forms.ToolTipIcon]::Info)
[System.Windows.Forms.Application]::Run()
