import type { ThemeId } from '../types/wallpaper'

export interface ThemePalette {
  id: ThemeId
  label: string
  hint: string
  /** Surface ladder, darkest to lightest. */
  base: string
  surface: string
  card: string
  elevated: string
  /** Hairlines are drawn from this colour at low alpha. */
  line: string
  muted: string
  subtle: string
  accent: string
  accentSoft: string
  accentAlt: string
}

export const THEMES: ThemePalette[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    hint: 'The default. Near-black surfaces with an indigo accent.',
    base: '#0a0a0b',
    surface: '#0f0f11',
    card: '#141416',
    elevated: '#1b1b1e',
    line: '#ffffff',
    muted: '#8b8b93',
    subtle: '#63636b',
    accent: '#7b7cf0',
    accentSoft: '#aaabf7',
    accentAlt: '#5b8def',
  },
  {
    id: 'slate',
    label: 'Slate',
    hint: 'Cool blue-grey, slightly deeper than Midnight.',
    base: '#080a10',
    surface: '#0c0f16',
    card: '#11151d',
    elevated: '#181d27',
    line: '#eaf0ff',
    muted: '#8a90a0',
    subtle: '#616879',
    accent: '#5b8def',
    accentSoft: '#93b4f7',
    accentAlt: '#7b7cf0',
  },
  {
    id: 'graphite',
    label: 'Graphite',
    hint: 'Monochrome. No colour anywhere but the wallpaper.',
    base: '#0b0b0c',
    surface: '#101011',
    card: '#161617',
    elevated: '#1e1e21',
    line: '#ffffff',
    muted: '#919196',
    subtle: '#68686d',
    accent: '#6f7078',
    accentSoft: '#b4b4bc',
    accentAlt: '#8a8a94',
  },
  {
    id: 'plum',
    label: 'Plum',
    hint: 'Violet-tinted dark with a brighter purple accent.',
    base: '#0d0a10',
    surface: '#120e17',
    card: '#18131f',
    elevated: '#211929',
    line: '#f6ecff',
    muted: '#9a8fa6',
    subtle: '#6f6479',
    accent: '#a374e8',
    accentSoft: '#c9a8f5',
    accentAlt: '#7b7cf0',
  },
  {
    id: 'moss',
    label: 'Moss',
    hint: 'Deep green with a muted jade accent.',
    base: '#0a0d0b',
    surface: '#0e1310',
    card: '#131a15',
    elevated: '#1b241c',
    line: '#ecfff2',
    muted: '#8c988f',
    subtle: '#626e64',
    accent: '#4e9c72',
    accentSoft: '#8ccfa9',
    accentAlt: '#4f9d8c',
  },
  {
    id: 'ember',
    label: 'Ember',
    hint: 'Warm brown-black with a clay accent.',
    base: '#0e0b09',
    surface: '#13100d',
    card: '#1a1512',
    elevated: '#231c17',
    line: '#fff2e8',
    muted: '#9d938a',
    subtle: '#6e6459',
    accent: '#c9764a',
    accentSoft: '#eba887',
    accentAlt: '#d19a4e',
  },
]

export const DEFAULT_THEME: ThemeId = 'midnight'

const STORAGE_KEY = 'wallflow:theme'

const BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]))

const CSS_VARS: Array<[string, keyof ThemePalette]> = [
  ['--wf-base', 'base'],
  ['--wf-surface', 'surface'],
  ['--wf-card', 'card'],
  ['--wf-elevated', 'elevated'],
  ['--wf-line', 'line'],
  ['--wf-muted', 'muted'],
  ['--wf-subtle', 'subtle'],
  ['--wf-accent', 'accent'],
  ['--wf-accent-soft', 'accentSoft'],
  ['--wf-accent-alt', 'accentAlt'],
]

/** `#7b7cf0` -> `123 124 240`, so Tailwind can apply alpha modifiers. */
export function toTriplet(hex: string): string {
  const raw = hex.replace('#', '')
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw
  const value = Number.parseInt(full, 16)
  if (!Number.isFinite(value)) return '0 0 0'
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`
}

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && BY_ID.has(value as ThemeId)
}

export function getTheme(id: ThemeId): ThemePalette {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_THEME)!
}

// Typed locally so this module also typechecks in the main process, which has no DOM lib.
interface ThemeRoot {
  style: { setProperty(name: string, value: string): void }
  dataset: Record<string, string>
}

interface ThemeGlobals {
  document?: { documentElement: ThemeRoot }
  localStorage?: {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
  }
}

const env = (): ThemeGlobals => globalThis as unknown as ThemeGlobals

/** Writes the palette onto :root and remembers it for the next cold start. */
export function applyTheme(id: ThemeId): void {
  const theme = getTheme(id)
  const root = env().document?.documentElement
  if (!root) return
  for (const [name, key] of CSS_VARS) {
    root.style.setProperty(name, toTriplet(theme[key] as string))
  }
  root.dataset.theme = theme.id
  try {
    env().localStorage?.setItem(STORAGE_KEY, theme.id)
  } catch {
    // Private mode or a blocked origin: the saved settings still drive it.
  }
}

/**
 * Reads the last applied theme synchronously so the first paint matches the
 * saved setting instead of flashing the default palette.
 */
export function cachedTheme(): ThemeId {
  try {
    const value = env().localStorage?.getItem(STORAGE_KEY)
    if (isThemeId(value)) return value
  } catch {
    // Ignore: fall through to the default.
  }
  return DEFAULT_THEME
}
