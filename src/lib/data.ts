import type { LatLng, OsmData, Poi } from '../types'
import type { SidewalkCollection } from './network'

export const TAOYUAN_STATION: LatLng = { lat: 24.98925, lng: 121.31404 }
export const DEMO_RADIUS_M = 1500

export interface DataStatus {
  network: 'live' | 'demo' | 'loading'
  sidewalk: boolean
  places: 'google' | 'osm'
  reports: 'shared' | 'local'
  ai: 'server' | 'keyword'
  map: 'google' | 'osm'
}

/** 示範路網（隨站台部署，秒開） */
export async function loadDemoNetwork(): Promise<OsmData> {
  const res = await fetch('/data/osm_taoyuan_station.json')
  const data = (await res.json()) as OsmData
  data.meta.demo = true
  return data
}

/** 即時路網：Cloudflare Function 代發 Overpass（邊緣快取 1h）；失敗回 null，維持示範路網 */
export async function loadLiveNetwork(center: LatLng, radius = DEMO_RADIUS_M): Promise<OsmData | null> {
  try {
    const url = `/api/overpass?lat=${center.lat.toFixed(5)}&lng=${center.lng.toFixed(5)}&r=${radius}`
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) })
    if (!res.ok) return null
    const data = (await res.json()) as OsmData
    return data.ways?.length > 50 ? data : null
  } catch {
    return null
  }
}

export async function loadSidewalks(): Promise<SidewalkCollection | null> {
  try {
    const res = await fetch('/data/sidewalk_taoyuan_station_1500m.geojson')
    if (!res.ok) return null
    return (await res.json()) as SidewalkCollection
  } catch {
    return null
  }
}

/** Google Places (New) 經 Function 代發；失敗回 null → 用 OSM POI */
export async function searchPlaces(q: string, near: LatLng): Promise<Poi[] | null> {
  try {
    const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&lat=${near.lat}&lng=${near.lng}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = (await res.json()) as { places: Poi[] }
    return data.places
  } catch {
    return null
  }
}

/** 本地搜尋：OSM POI 名稱比對 */
export function searchLocal(q: string, pois: Poi[], near: LatLng, limit = 8): Poi[] {
  const t = q.trim().toLowerCase()
  if (!t) return []
  const scored = pois
    .map((p) => {
      const n = p.name.toLowerCase()
      const en = (p.en ?? '').toLowerCase()
      let s = 0
      if (n === t || en === t) s = 100
      else if (n.startsWith(t) || en.startsWith(t)) s = 60
      else if (n.includes(t) || en.includes(t)) s = 40
      else return null
      const d = Math.hypot((p.lat - near.lat) * 111000, (p.lng - near.lng) * 101000)
      return { p, s: s - d / 200 }
    })
    .filter((x): x is { p: Poi; s: number } => !!x)
    .sort((a, b) => b.s - a.s)
  return scored.slice(0, limit).map((x) => x.p)
}
