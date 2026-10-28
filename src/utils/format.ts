export function formatResolution(width: number, height: number): string {
  if (!width || !height) return 'Unknown size'
  return `${width} × ${height}`
}

export function resolutionLabel(height: number): string {
  if (height >= 2100) return '4K'
  if (height >= 1400) return '1440p'
  if (height >= 1050) return '1080p'
  if (height > 0) return 'HD'
  return 'Unknown'
}

export function formatCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
  return String(count)
}

export function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.round((minutes / 60) * 10) / 10
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

export function timeUntil(timestamp: number | null): string {
  if (!timestamp) return '—'
  const diff = timestamp - Date.now()
  if (diff <= 0) return 'now'
  const minutes = Math.ceil(diff / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours}h ${rest}m` : `${hours}h`
}

/** URL-safe hostname for feed labels. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
