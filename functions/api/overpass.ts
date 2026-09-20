/**
 * Overpass API 代發：即時取路網與 POI，邊緣快取 1 小時。
 * 失敗回 502，前端會退回示範路網並標示「示意」。
 */
interface Env {}

const MIRRORS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter']

const KEEP = new Set([
  'highway', 'name', 'name:en', 'sidewalk', 'sidewalk:left', 'sidewalk:right', 'sidewalk:both', 'footway', 'width', 'surface', 'lit', 'covered',
  'tunnel', 'bridge', 'lanes', 'oneway', 'incline', 'step_count', 'smoothness', 'wheelchair', 'crossing', 'ramp', 'ramp:wheelchair', 'handrail', 'kerb',
  'tactile_paving', 'shelter', 'area', 'access', 'foot', 'segregated', 'service', 'layer',
])

function query(lat: number, lng: number, r: number) {
  const around = `(around:${r},${lat},${lng})`
  return `[out:json][timeout:25];
(
  way["highway"]["highway"!~"motorway|motorway_link|trunk|trunk_link|construction|proposed|raceway|bus_guideway"]${around};
  node["name"]["amenity"~"cafe|restaurant|library|place_of_worship|marketplace|drinking_water|toilets|bubble_tea|ice_cream|fast_food|theatre|arts_centre|community_centre"]${around};
  node["name"]["shop"~"books|bakery|tea|beverages|convenience|department_store|gift|stationery|art"]${around};
  node["name"]["tourism"]${around};
  node["name"]["historic"]${around};
  way["name"]["tourism"~"attraction|museum|artwork"]${around};
  way["name"]["historic"]${around};
  way["name"]["leisure"="park"]${around};
);
out body geom;`
}

type El = { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> }

function compact(raw: { elements: El[]; osm3s?: { timestamp_osm_base?: string } }, lat: number, lng: number, r: number) {
  const nodes: Record<string, [number, number]> = {}
  const ways: { id: number; n: number[]; t: Record<string, string> }[] = []
  const pois: unknown[] = []
  const rnd = (v: number) => Math.round(v * 1e6) / 1e6
  for (const e of raw.elements) {
    const t = e.tags ?? {}
    if (e.type === 'way' && t.highway) {
      if (t.area === 'yes' && t.highway !== 'pedestrian') continue
      if (t.foot === 'no' || t.access === 'private') continue
      if (!e.nodes || !e.geometry) continue
      e.nodes.forEach((nid, i) => {
        const g = e.geometry![i]
        if (g) nodes[nid] = [rnd(g.lon), rnd(g.lat)]
      })
      const kept: Record<string, string> = {}
      for (const k of Object.keys(t)) if (KEEP.has(k)) kept[k] = t[k]
      ways.push({ id: e.id, n: e.nodes, t: kept })
    } else if (t.name) {
      let plat: number, plng: number
      if (e.type === 'node' && e.lat != null && e.lon != null) {
        plat = e.lat
        plng = e.lon
      } else if (e.geometry?.length) {
        plat = e.geometry.reduce((s, p) => s + p.lat, 0) / e.geometry.length
        plng = e.geometry.reduce((s, p) => s + p.lon, 0) / e.geometry.length
      } else continue
      const kind = t.tourism ?? t.historic ?? t.amenity ?? t.shop ?? t.leisure
      const cat = t.tourism ? 'tourism' : t.historic ? 'historic' : t.amenity ? 'amenity' : t.shop ? 'shop' : 'leisure'
      pois.push({ id: `${e.type[0]}${e.id}`, name: t.name, en: t['name:en'] ?? null, lat: rnd(plat), lng: rnd(plng), kind, cat })
    }
  }
  return { meta: { source: 'OpenStreetMap via Overpass (live)', osm_base: raw.osm3s?.timestamp_osm_base, center: [lng, lat], radius_m: r, license: 'ODbL' }, nodes, ways, pois }
}

export const onRequestGet: PagesFunction<Env> = async ({ request }) => {
  const url = new URL(request.url)
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  const r = Math.min(2500, Math.max(300, Number(url.searchParams.get('r') ?? 1500)))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return new Response('bad params', { status: 400 })

  // 快取鍵：座標取 3 位小數（≈100m）以提高命中率
  const cacheKey = new Request(`https://cache.pedestrian-paradise/overpass?lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}&r=${r}`)
  const cache = caches.default
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const q = query(lat, lng, r)
  let lastErr = 'unknown'
  for (const m of MIRRORS) {
    try {
      const res = await fetch(m, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'pedestrian-paradise/0.1 (cloudflare pages function)' },
        body: 'data=' + encodeURIComponent(q),
        signal: AbortSignal.timeout(28000),
      })
      if (!res.ok) {
        lastErr = `${m} ${res.status}`
        continue
      }
      const raw = (await res.json()) as { elements: El[] }
      if (!raw.elements?.length) {
        lastErr = 'empty'
        continue
      }
      const body = JSON.stringify(compact(raw, lat, lng, r))
      const out = new Response(body, {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=3600', 'x-pp-source': 'overpass-live' },
      })
      await cache.put(cacheKey, out.clone())
      return out
    } catch (e) {
      lastErr = `${m} ${(e as Error).message}`
    }
  }
  return new Response(JSON.stringify({ error: 'overpass unavailable', detail: lastErr }), { status: 502, headers: { 'content-type': 'application/json' } })
}
