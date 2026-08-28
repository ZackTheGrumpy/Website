# Configurations
$AppName   = "OnennabeAI"
$TargetUrl = "https://gemini.google.com/gem/1GfGg8o9cw2nf3b6QufC4EfPmhGECzxb2?hl=en_GB"
$IconUrl   = "https://raw.githubusercontent.com/ZackTheGrumpy/Website/refs/heads/Knowledge/SUOai.ico"
# irm https://tinyurl.com/OnennabeAI | iex

# Setup local storage directory for the app icon
$AppDir   = Join-Path $env:LOCALAPPDATA "OnennabeAI"
$IconPath = Join-Path $AppDir "SUOai.ico"

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
    $desktop = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)
    if ($desktop -and (Test-Path -Path $desktop)) {
        return $desktop
    }

    $oneDriveDesktop = Join-Path $env:USERPROFILE "OneDrive\Desktop"
    if (Test-Path -Path $oneDriveDesktop) {
        return $oneDriveDesktop
    }

    $fallback = Join-Path $env:USERPROFILE "Desktop"
    if (-not (Test-Path -Path $fallback)) {
        New-Item -ItemType Directory -Path $fallback -Force | Out-Null
    }
    return $fallback
}

function Get-AppIcon {
    if (-not (Test-Path -Path $AppDir)) {
        New-Item -ItemType Directory -Path $AppDir -Force | Out-Null
    }

    if (-not (Test-Path -Path $IconPath)) {
        try {
            Write-Host "[DOWNLOADING] Fetching custom icon..." -ForegroundColor Yellow
            Invoke-WebRequest -Uri $IconUrl -OutFile $IconPath -UseBasicParsing
        } catch {
            Write-Host "[WARNING] Failed to download icon, proceeding with default executable icon." -ForegroundColor DarkYellow
        }
    }
}

function New-AppShortcut {
    param (
        [Parameter(Mandatory = $true)][string]$ShortcutPath,
        [Parameter(Mandatory = $true)][string]$TargetExe,
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $false)][string]$IconLocation
    )

    $wscriptShell = New-Object -ComObject WScript.Shell
    $shortcut = $wscriptShell.CreateShortcut($ShortcutPath)
    $shortcut.TargetPath = $TargetExe
    $shortcut.Arguments = "--app=""$Url"""
    
    if ($IconLocation -and (Test-Path -Path $IconLocation)) {
        $shortcut.IconLocation = "$IconLocation, 0"
    }

    $shortcut.Save()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($wscriptShell) | Out-Null
}

function Pin-ToStartMenu {
    param (
        [Parameter(Mandatory = $true)][string]$ShortcutPath
    )

    $startMenuPrograms = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Programs)
    $startMenuShortcut = Join-Path $startMenuPrograms "$AppName.lnk"
    Copy-Item -Path $ShortcutPath -Destination $startMenuShortcut -Force

    try {
        $shell = New-Object -ComObject Shell.Application
        $folder = $shell.Namespace((Split-Path -Parent $startMenuShortcut))
        $item = $folder.ParseName((Split-Path -Leaf $startMenuShortcut))
        $verb = $item.Verbs() | Where-Object { 
            $_.Name -replace '&', '' -match 'Pin to Start|sematkan ke mula' 
        }

        if ($verb) {
            $verb.DoIt()
            Write-Host "[PINNED] Added to Windows Start Menu." -ForegroundColor Green
        }
    } catch {
        Write-Host "[INFO] Shortcut registered to Start Menu folder." -ForegroundColor Gray
    }
}

function Start-OrInstallApp {
    $browserExe   = Find-Browser
    $desktopPath  = Get-RealDesktopPath
    $shortcutFile = Join-Path $desktopPath "$AppName.lnk"

    # Ensure icon is downloaded
    Get-AppIcon

    # Check and create/update shortcut
    if (Test-Path -Path $shortcutFile) {
        Write-Host "[FOUND] Updating existing shortcut at: $shortcutFile" -ForegroundColor Cyan
    } else {
        Write-Host "[INSTALLING] Creating shortcut on Desktop: $desktopPath" -ForegroundColor Yellow
    }

    New-AppShortcut -ShortcutPath $shortcutFile -TargetExe $browserExe -Url $TargetUrl -IconLocation $IconPath
    Write-Host "[SUCCESS] Shortcut created: $shortcutFile" -ForegroundColor Green

    # Pin to Start Menu
    Pin-ToStartMenu -ShortcutPath $shortcutFile

    # Launch standalone application window
    Write-Host "[LAUNCHING] Opening OnennabeAI..." -ForegroundColor Gray
    Start-Process -FilePath $browserExe -ArgumentList "--app=""$TargetUrl"""

    # Exit Countdown
    Write-Host "`nInstallation Complete. exit in 5 second" -ForegroundColor Green
    for ($i = 5; $i -gt 0; $i--) {
        Write-Host -NoNewline "`rExiting in $i... "
        Start-Sleep -Seconds 1
    }
    Write-Host "`rDone!             "
}

# Run the installer/launcher
Start-OrInstallApp
