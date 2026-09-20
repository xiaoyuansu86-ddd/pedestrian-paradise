import type { Report, ReportType } from '../types'

const KEY = 'pp.reports.v1'

export const REPORT_TYPES: { type: ReportType; label: string; emoji: string; desc: string }[] = [
  { type: 'pothole', label: '路面不平／坑洞', emoji: '🕳️', desc: '鋪面破損、高低落差、積水' },
  { type: 'arcade_blocked', label: '騎樓被佔用', emoji: '🛵', desc: '機車、攤販、雜物擋住通道' },
  { type: 'no_ramp', label: '缺路緣斜坡', emoji: '♿', desc: '輪椅、推車上下不了' },
  { type: 'narrow', label: '太窄過不去', emoji: '↔️', desc: '淨寬不足 0.9m' },
  { type: 'dark', label: '照明不足', emoji: '🌑', desc: '夜間太暗、沒路燈' },
  { type: 'good', label: '這段很好走', emoji: '👍', desc: '平整、寬敞、有遮蔭' },
]

export function loadLocalReports(): Report[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Report[]
  } catch {
    return []
  }
}

export function saveLocalReport(r: Report) {
  const all = loadLocalReports()
  all.push(r)
  localStorage.setItem(KEY, JSON.stringify(all.slice(-500)))
}

/** 從 Cloudflare KV 拉共享回報；失敗就只用本機 */
export async function fetchSharedReports(): Promise<{ reports: Report[]; shared: boolean }> {
  try {
    const res = await fetch('/api/reports', { signal: AbortSignal.timeout(6000) })
    if (!res.ok) throw new Error(String(res.status))
    const data = (await res.json()) as { reports: Report[] }
    return { reports: data.reports ?? [], shared: true }
  } catch {
    return { reports: [], shared: false }
  }
}

export async function submitReport(r: Report): Promise<boolean> {
  saveLocalReport(r)
  try {
    const res = await fetch('/api/reports', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(r),
      signal: AbortSignal.timeout(6000),
    })
    return res.ok
  } catch {
    return false
  }
}

export function mergeReports(a: Report[], b: Report[]): Report[] {
  const m = new Map<string, Report>()
  for (const r of [...a, ...b]) m.set(r.id, r)
  return [...m.values()]
}

export function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
