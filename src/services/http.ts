import axios from 'axios'

export const http = axios.create({
  timeout: 20000,
  headers: {
    'User-Agent': 'WallFlow/1.0 (desktop wallpaper app)',
    Accept: 'application/json, text/plain, */*',
  },
})

export function describeError(error: unknown, fallback = 'Request failed'): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status
    if (status === 401 || status === 403) return 'Invalid or missing API key'
    if (status === 429) return 'Rate limit reached — try again in a moment'
    if (status && status >= 500) return 'Source is temporarily unavailable'

    const data = error.response?.data as { errors?: unknown[]; error?: string } | undefined
    const first = data?.errors?.[0]
    if (typeof first === 'string') return first
    if (data?.error) return String(data.error)
    if (error.code === 'ECONNABORTED') return 'Request timed out'
    return error.message
  }
  return error instanceof Error ? error.message : fallback
}
