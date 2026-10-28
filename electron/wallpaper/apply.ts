import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/**
 * Applies a desktop wallpaper.
 *
 * On Windows this calls User32!SystemParametersInfo (SPI_SETDESKWALLPAPER) through
 * PowerShell, which is the same mechanism the `wallpaper` npm package uses — no
 * native addon to rebuild, and it works in both dev and packaged builds.
 */
export async function setDesktopWallpaper(imagePath: string): Promise<void> {
  if (process.platform === 'win32') {
    return setWindowsWallpaper(imagePath)
  }
  if (process.platform === 'darwin') {
    return runCommand('osascript', [
      '-e',
      `tell application "System Events" to set picture of every desktop to POSIX file "${imagePath}"`,
    ])
  }
  return setLinuxWallpaper(imagePath)
}

const WINDOWS_SCRIPT = `param([string]$Image)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public static class WallFlowNative {
  [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int SystemParametersInfo(int uAction, int uParam, string lpvParam, int fuWinIni);
}
"@
# Fill the screen instead of tiling/stretching.
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name WallpaperStyle -Value '10' -Force
Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name TileWallpaper -Value '0' -Force
$ok = [WallFlowNative]::SystemParametersInfo(20, 0, $Image, 3)
if ($ok -eq 0) {
  $code = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
  Write-Error "SystemParametersInfo failed with code $code"
  exit 1
}
`

async function setWindowsWallpaper(imagePath: string): Promise<void> {
  const scriptPath = path.join(os.tmpdir(), `wallflow-${randomUUID()}.ps1`)
  await fs.writeFile(scriptPath, WINDOWS_SCRIPT, 'utf8')

  try {
    await runCommand('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-Image',
      imagePath,
    ])
  } finally {
    await fs.rm(scriptPath, { force: true }).catch(() => undefined)
  }
}

async function setLinuxWallpaper(imagePath: string): Promise<void> {
  const uri = `file://${imagePath}`
  try {
    await runCommand('gsettings', ['set', 'org.gnome.desktop.background', 'picture-uri', uri])
  } catch {
    await runCommand('feh', ['--bg-fill', imagePath])
  }
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stderr = ''

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('error', (error) => reject(error))
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr.trim() || `${command} exited with code ${code}`))
    })
  })
}
