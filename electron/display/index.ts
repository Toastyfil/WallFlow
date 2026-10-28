import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { DisplayInfo, DisplayMode } from '../../src/types/ipc'

const DISPLAY_SCRIPT = String.raw`param(
  [string]$Action = 'list',
  [int]$Width = 0,
  [int]$Height = 0,
  [int]$Refresh = 0
)
$ErrorActionPreference = 'Stop'

$code = @'
using System;
using System.Runtime.InteropServices;

public class WallFlowDisplay
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct DEVMODE
    {
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;
        public ushort dmSpecVersion;
        public ushort dmDriverVersion;
        public ushort dmSize;
        public ushort dmDriverExtra;
        public uint dmFields;
        public int dmPositionX;
        public int dmPositionY;
        public uint dmDisplayOrientation;
        public uint dmDisplayFixedOutput;
        public short dmColor;
        public short dmDuplex;
        public short dmYResolution;
        public short dmTTOption;
        public short dmCollate;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;
        public ushort dmLogPixels;
        public uint dmBitsPerPel;
        public uint dmPelsWidth;
        public uint dmPelsHeight;
        public uint dmDisplayFlags;
        public uint dmDisplayFrequency;
        public uint dmICMMethod;
        public uint dmICMIntent;
        public uint dmMediaType;
        public uint dmDitherType;
        public uint dmReserved1;
        public uint dmReserved2;
        public uint dmPanningWidth;
        public uint dmPanningHeight;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    public static extern bool EnumDisplaySettings(string lpszDeviceName, int iModeNum, ref DEVMODE lpDevMode);

    [DllImport("user32.dll")]
    public static extern int ChangeDisplaySettings(ref DEVMODE lpDevMode, int dwFlags);
}
'@

Add-Type -TypeDefinition $code
$size = [System.Runtime.InteropServices.Marshal]::SizeOf([type]'WallFlowDisplay+DEVMODE')

function New-DevMode {
    $dm = New-Object WallFlowDisplay+DEVMODE
    $dm.dmSize = $size
    return $dm
}

if ($Action -eq 'list') {
    $modes = New-Object System.Collections.Generic.List[string]
    for ($i = 0; $i -lt 500; $i++) {
        $dm = New-DevMode
        if (-not [WallFlowDisplay]::EnumDisplaySettings([NullString]::Value, $i, [ref]$dm)) { break }
        if ($dm.dmBitsPerPel -lt 32) { continue }
        if ($dm.dmPelsWidth -lt 800) { continue }
        $entry = "$($dm.dmPelsWidth)x$($dm.dmPelsHeight)@$($dm.dmDisplayFrequency)"
        if (-not $modes.Contains($entry)) { $modes.Add($entry) }
    }

    $current = New-DevMode
    [void][WallFlowDisplay]::EnumDisplaySettings([NullString]::Value, -1, [ref]$current)

    $payload = @{
        current = @{
            width = [int]$current.dmPelsWidth
            height = [int]$current.dmPelsHeight
            refresh = [int]$current.dmDisplayFrequency
        }
        modes = $modes.ToArray()
    }
    $payload | ConvertTo-Json -Depth 4 -Compress
    exit 0
}

$mode = New-DevMode
if (-not [WallFlowDisplay]::EnumDisplaySettings([NullString]::Value, -1, [ref]$mode)) {
    Write-Output 'error:EnumDisplaySettings failed'
    exit 1
}

$DM_PELSWIDTH = 0x80000
$DM_PELSHEIGHT = 0x100000
$DM_DISPLAYFREQUENCY = 0x400000

$mode.dmPelsWidth = [uint32]$Width
$mode.dmPelsHeight = [uint32]$Height
$mode.dmFields = [uint32]($DM_PELSWIDTH -bor $DM_PELSHEIGHT)
if ($Refresh -gt 0) {
    $mode.dmDisplayFrequency = [uint32]$Refresh
    $mode.dmFields = [uint32]($mode.dmFields -bor $DM_DISPLAYFREQUENCY)
}

# CDS_UPDATEREGISTRY | CDS_GLOBAL
$result = [WallFlowDisplay]::ChangeDisplaySettings([ref]$mode, 5)
Write-Output "result:$result"
`

interface RawDisplayPayload {
  current?: Partial<DisplayMode>
  modes?: string[]
}

async function runDisplayScript(args: string[]): Promise<string> {
  const scriptPath = path.join(os.tmpdir(), `wallflow-display-${randomUUID()}.ps1`)
  await fs.writeFile(scriptPath, DISPLAY_SCRIPT, 'utf8')

  try {
    return await new Promise<string>((resolve, reject) => {
      const child = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
        { windowsHide: true },
      )
      let stdout = ''
      let stderr = ''
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })
      child.on('error', reject)
      child.on('close', (code) => {
        if (code === 0) resolve(stdout.trim())
        else reject(new Error(stderr.trim() || `Display script exited with code ${code}`))
      })
    })
  } finally {
    await fs.rm(scriptPath, { force: true }).catch(() => undefined)
  }
}

export async function getDisplayInfo(): Promise<DisplayInfo> {
  if (process.platform !== 'win32') {
    throw new Error('Changing display resolution is only supported on Windows')
  }

  const output = await runDisplayScript(['-Action', 'list'])
  const payload = JSON.parse(output || '{}') as RawDisplayPayload

  // One entry per resolution, keeping the highest refresh rate the display supports.
  const bySize = new Map<string, DisplayMode>()
  for (const entry of payload.modes ?? []) {
    const [size, refresh] = entry.split('@')
    const [width, height] = size.split('x').map(Number)
    if (!width || !height) continue
    const key = `${width}x${height}`
    const next: DisplayMode = { width, height, refresh: Number(refresh) || 0 }
    const existing = bySize.get(key)
    if (!existing || next.refresh > existing.refresh) bySize.set(key, next)
  }

  const modes = [...bySize.values()].sort((a, b) => b.width * b.height - a.width * a.height)

  const current: DisplayMode = {
    width: Number(payload.current?.width) || 0,
    height: Number(payload.current?.height) || 0,
    refresh: Number(payload.current?.refresh) || 0,
  }

  return { current, modes }
}

const CHANGE_MESSAGES: Record<number, string> = {
  0: 'Resolution changed',
  1: 'Resolution will change after a restart',
  [-1]: 'The display driver rejected the change',
  [-2]: 'That resolution is not supported by this display',
  [-3]: 'The resolution was not applied',
  [-4]: 'Invalid display flags',
  [-5]: 'Invalid display parameters',
  [-6]: 'The change failed because of a multi-display setup',
}

export async function setDisplayMode(mode: DisplayMode): Promise<{ ok: boolean; message: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'Changing display resolution is only supported on Windows' }
  }
  if (!Number.isFinite(mode.width) || !Number.isFinite(mode.height) || mode.width < 640 || mode.height < 480) {
    return { ok: false, message: 'Invalid resolution' }
  }

  const output = await runDisplayScript([
    '-Action',
    'set',
    '-Width',
    String(mode.width),
    '-Height',
    String(mode.height),
    '-Refresh',
    String(mode.refresh ?? 0),
  ])

  const match = output.match(/result:(-?\d+)/)
  const code = match ? Number(match[1]) : -1
  return { ok: code === 0 || code === 1, message: CHANGE_MESSAGES[code] ?? 'Display change failed' }
}
