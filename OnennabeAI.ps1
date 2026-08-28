# Setup App Configurations
$AppName   = "Gemini Gem App"
$TargetUrl = "https://gemini.google.com/gem/1GfGg8o9cw2nf3b6QufC4EfPmhGECzxb2?hl=en_GB"

function Find-Browser {
    $candidates = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
    )

    foreach ($path in $candidates) {
        if (Test-Path -Path $path -PathType Leaf) {
            return $path
        }
    }

    throw "Neither Google Chrome nor Microsoft Edge was found."
}

function Get-RealDesktopPath {
    # Query system for active Desktop folder (handles OneDrive/known-folder redirection)
    $desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    if ($desktop -and (Test-Path -Path $desktop)) {
        return $desktop
    }

    # Fallback to OneDrive Desktop
    $oneDriveDesktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
    if (Test-Path -Path $oneDriveDesktop) {
        return $oneDriveDesktop
    }

    # Ultimate fallback to default local Desktop
    $fallback = Join-Path $env:USERPROFILE "Desktop"
    if (-not (Test-Path -Path $fallback)) {
        New-Item -ItemType Directory -Path $fallback -Force | Out-Null
    }
    return $fallback
}

function New-AppShortcut {
    param (
        [Parameter(Mandatory = $true)][string]$ShortcutPath,
        [Parameter(Mandatory = $true)][string]$TargetExe,
        [Parameter(Mandatory = $true)][string]$Url
    )

    $wscriptShell = New-Object -ComObject WScript.Shell
    $shortcut = $wscriptShell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetExe
    $shortcut.Arguments = "--app=""$Url"""
    $shortcut.Save()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wscriptShell) | Out-Null
}

function Start-OrInstallApp {
    $browserExe   = Find-Browser
    $desktopPath  = Get-RealDesktopPath
    $shortcutFile = Join-Path $desktopPath "$AppName.lnk"

    # Check and create shortcut if missing
    if (Test-Path -Path $shortcutFile) {
        Write-Host "[FOUND] Shortcut already exists at: $shortcutFile" -ForegroundColor Cyan
    } else {
        Write-Host "[INSTALLING] Target Desktop: $desktopPath" -ForegroundColor Yellow
        New-AppShortcut -ShortcutPath $shortcutFile -TargetExe $browserExe -Url $TargetUrl
        Write-Host "[SUCCESS] Created shortcut: $shortcutFile" -ForegroundColor Green
    }

    # Launch standalone application window
    Write-Host "[LAUNCHING] Opening app window..." -ForegroundColor Gray
    Start-Process -FilePath $browserExe -ArgumentList "--app=""$TargetUrl"""
}

# Run the installer/launcher
Start-OrInstallApp