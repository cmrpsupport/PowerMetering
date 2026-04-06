# Power Monitor - Create desktop shortcut
# Double-clicking the shortcut opens the dashboard in the default browser.
#
# Run directly:
#   powershell -ExecutionPolicy Bypass -File scripts\install-desktop-shortcut.ps1

$AppUrl  = "http://localhost:5173"
$AppName = "Power Monitor"
$Desktop = [Environment]::GetFolderPath("Desktop")
$LnkPath = Join-Path $Desktop "$AppName.lnk"

$ws       = New-Object -ComObject WScript.Shell
$shortcut = $ws.CreateShortcut($LnkPath)

$shortcut.TargetPath  = "powershell.exe"
$shortcut.Arguments   = "-NoProfile -WindowStyle Hidden -Command `"Start-Process '$AppUrl'`""
$shortcut.Description = "Open Power Monitor Dashboard"
# Shell32 icon 13 = globe/internet
$shortcut.IconLocation = "%SystemRoot%\System32\shell32.dll,13"
$shortcut.Save()

Write-Host "Shortcut created: $LnkPath" -ForegroundColor Green
