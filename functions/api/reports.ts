/**
 * 群眾回報（第一手步行體驗數據庫）— Cloudflare KV
 * GET  /api/reports            → { reports: Report[] }
 * POST /api/reports {Report}   → { ok: true }
 * KV 未綁定 → 503，前端只用 localStorage。
 */
interface Env {
  REPORTS?: KVNamespace
}

type Report = { id: string; lat: number; lng: number; type: string; note?: string; stars?: number; ts: number; sensor?: { rms: number; samples: number } }
const KEY = 'reports:v1'
const TYPES = new Set(['pothole', 'arcade_blocked', 'no_ramp', 'dark', 'narrow', 'good'])
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.REPORTS) return json({ fallback: true, reports: [] }, 503)
  const all = ((await env.REPORTS.get(KEY, 'json')) as Report[] | null) ?? []
  return json({ reports: all })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.REPORTS) return json({ fallback: true }, 503)
  let r: Report
  try {
    r = (await request.json()) as Report
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  if (!r || typeof r.lat !== 'number' || typeof r.lng !== 'number' || !TYPES.has(r.type)) return json({ error: 'bad report' }, 400)
  const clean: Report = {
    id: String(r.id ?? crypto.randomUUID()).slice(0, 40),
    lat: r.lat,
    lng: r.lng,
    type: r.type,
    note: r.note ? String(r.note).slice(0, 200) : undefined,
    stars: typeof r.stars === 'number' ? Math.max(1, Math.min(5, Math.round(r.stars))) : undefined,
    ts: Date.now(),
    sensor: r.sensor && typeof r.sensor.rms === 'number' ? { rms: r.sensor.rms, samples: r.sensor.samples } : undefined,
  }
  const all = ((await env.REPORTS.get(KEY, 'json')) as Report[] | null) ?? []
  all.push(clean)
  await env.REPORTS.put(KEY, JSON.stringify(all.slice(-2000)))
  return json({ ok: true, id: clean.id })
}
