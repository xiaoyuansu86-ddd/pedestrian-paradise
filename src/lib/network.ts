import type { Edge, EdgeAttrs, Graph, LatLng, LngLat, OsmData, Poi, Report, ReportType } from '../types'
import { GridIndex, bearing, distLngLat, haversine } from './geo'

type SidewalkFeature = {
  type: 'Feature'
  geometry: { type: 'MultiPolygon' | 'Polygon'; coordinates: number[][][][] | number[][][] }
  properties: { NAME?: string; SW_WTH?: number; SWW_WTH?: number; SW_RAMP?: number | string }
}
export type SidewalkCollection = { type: 'FeatureCollection'; features: SidewalkFeature[] }

const HIGH = new Set(['primary', 'primary_link', 'secondary', 'secondary_link', 'trunk'])
const MID = new Set(['tertiary', 'tertiary_link', 'unclassified', 'busway'])
const LOW = new Set(['residential', 'service', 'living_street', 'track'])
const PED = new Set(['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'corridor', 'elevator'])

function trafficOf(h: string): 0 | 1 | 2 | 3 {
  if (HIGH.has(h)) return 3
  if (MID.has(h)) return 2
  if (LOW.has(h)) return 1
  if (PED.has(h)) return 0
  return 1
}

const GOOD_SURF = new Set(['asphalt', 'paving_stones', 'concrete', 'paved', 'concrete:plates', 'acrylic', 'wood'])
const BAD_SURF = new Set(['sett', 'cobblestone', 'gravel', 'fine_gravel', 'ground', 'dirt', 'unpaved', 'grass', 'sand', 'compacted', 'pebblestone'])

function surfaceOf(t: Record<string, string>, h: string): 0 | 1 | 2 {
  const sm = t.smoothness
  if (sm && /bad|horrible|impassable/.test(sm)) return 2
  const s = t.surface
  if (s) {
    if (GOOD_SURF.has(s)) return 0
    if (BAD_SURF.has(s)) return 2
    return 1
  }
  if (h === 'track' || h === 'path') return 1
  return 0
}

function baseAttrs(t: Record<string, string>): EdgeAttrs {
  const h = t.highway
  const traffic = trafficOf(h)
  let sidewalk: EdgeAttrs['sidewalk'] = 'unknown'
  if (PED.has(h) || h === 'living_street') sidewalk = 'yes'
  else if (t.sidewalk && t.sidewalk !== 'no' && t.sidewalk !== 'none') sidewalk = 'yes'
  else if (t['sidewalk:both'] === 'yes' || t['sidewalk:left'] === 'yes' || t['sidewalk:right'] === 'yes') sidewalk = 'yes'
  else if (t.sidewalk === 'no' || t.sidewalk === 'none') sidewalk = 'no'
  else if (traffic === 3) sidewalk = 'no' // 未標註的大馬路：保守假設無

  const covered = t.covered === 'yes' || t.covered === 'arcade' || t.tunnel === 'yes' || t.tunnel === 'building_passage'
  // 遮蔭推估：騎樓/隧道 > 窄巷 > 一般 > 大馬路
  let shade = 0.35
  if (covered) shade = 1
  else if (h === 'footway' || h === 'pedestrian' || h === 'corridor') shade = 0.55
  else if (traffic === 1) shade = 0.6
  else if (traffic === 2) shade = 0.4
  else if (traffic === 3) shade = 0.2
  if (t.tunnel) shade = 1

  return {
    highway: h,
    name: t.name,
    traffic,
    sidewalk,
    steps: h === 'steps',
    elevator: h === 'elevator',
    surface: surfaceOf(t, h),
    lit: t.lit === 'yes' ? true : t.lit === 'no' ? false : null,
    covered,
    shade,
    pedestrianOnly: PED.has(h) || h === 'pedestrian',
    culture: 0,
    park: false,
    reports: [],
  }
}

function polygonRings(f: SidewalkFeature): number[][][] {
  const g = f.geometry
  if (g.type === 'Polygon') return g.coordinates as number[][][]
  return (g.coordinates as number[][][][]).flat()
}

const CULTURE_KINDS = new Set(['museum', 'attraction', 'artwork', 'gallery', 'place_of_worship', 'ruins', 'stele', 'house', 'books', 'library', 'community_centre', 'arts_centre', 'tea', 'gift', 'art', 'monument', 'memorial'])

/** 建立步行路網圖：OSM 路段 + 國土署人行道屬性 + 群眾回報 */
export function buildGraph(osm: OsmData, sidewalks: SidewalkCollection | null, reports: Report[], pois: Poi[]): Graph {
  const nodes = new Map<number, LngLat>()
  for (const [k, v] of Object.entries(osm.nodes)) nodes.set(Number(k), v)

  // 人行道頂點格網（≈ 22m 格）
  const swIndex = new GridIndex<{ p: LngLat; f: SidewalkFeature }>(0.0002, (o) => o.p)
  let sidewalkCount = 0
  if (sidewalks) {
    for (const f of sidewalks.features) {
      sidewalkCount++
      for (const ring of polygonRings(f)) {
        // 頂點取樣：每隔一點
        for (let i = 0; i < ring.length; i += 2) swIndex.add({ p: [ring[i][0], ring[i][1]], f })
      }
    }
  }
  const repIndex = new GridIndex<Report>(0.0003, (r) => [r.lng, r.lat])
  reports.forEach((r) => repIndex.add(r))
  const poiIndex = new GridIndex<Poi>(0.0006, (p) => [p.lng, p.lat])
  pois.forEach((p) => poiIndex.add(p))

  const edges: Edge[] = []
  const adj = new Map<number, Edge[]>()
  let id = 0
  const push = (e: Edge) => {
    edges.push(e)
    const arr = adj.get(e.from)
    if (arr) arr.push(e)
    else adj.set(e.from, [e])
  }

  for (const w of osm.ways) {
    const attrs0 = baseAttrs(w.t)
    for (let i = 1; i < w.n.length; i++) {
      const a = nodes.get(w.n[i - 1])
      const b = nodes.get(w.n[i])
      if (!a || !b) continue
      const len = distLngLat(a, b)
      if (len < 0.2) continue
      const mid: LngLat = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      const attrs: EdgeAttrs = { ...attrs0, reports: [] }

      // 國土署人行道：中點 12m 內有人行道多邊形頂點 → 掛上寬度/淨寬/斜坡
      if (sidewalkCount) {
        let best: { d: number; f: SidewalkFeature } | null = null
        for (const o of swIndex.near(mid, 1)) {
          const d = distLngLat(mid, o.p)
          if (d < 14 && (!best || d < best.d)) best = { d, f: o.f }
        }
        if (best && attrs.highway !== 'steps') {
          const p = best.f.properties
          attrs.sidewalk = 'yes'
          if (typeof p.SW_WTH === 'number') attrs.swWidth = p.SW_WTH
          if (typeof p.SWW_WTH === 'number') attrs.netWidth = p.SWW_WTH
          const r = p.SW_RAMP
          attrs.ramps = typeof r === 'number' ? r : r === 'N' ? -1 : Number(r) || 0
          if (attrs.shade < 0.5 && attrs.traffic >= 2) attrs.shade = 0.35 // 有人行道通常有行道樹/騎樓
        }
      }
      // 群眾回報：25m 內
      for (const r of repIndex.near(mid, 1)) {
        if (haversine({ lng: mid[0], lat: mid[1] }, r) < 25) attrs.reports.push(r.type as ReportType)
      }
      // 文化亮點 / 公園：60m 內
      for (const p of poiIndex.near(mid, 1)) {
        const d = distLngLat(mid, [p.lng, p.lat])
        if (d < 60 && CULTURE_KINDS.has(p.kind)) attrs.culture++
        if (d < 45 && p.kind === 'park') attrs.park = true
      }

      const brg = bearing(a, b)
      push({ id: id++, from: w.n[i - 1], to: w.n[i], len, bearing: brg, attrs, coords: [a, b] })
      push({ id: id++, from: w.n[i], to: w.n[i - 1], len, bearing: (brg + 180) % 360, attrs, coords: [b, a] })
    }
  }

  // 只保留有邊的節點，建最近節點索引
  const usedNodes = new Map<number, LngLat>()
  for (const [nid] of adj) usedNodes.set(nid, nodes.get(nid)!)
  const nodeIndex = new GridIndex<{ id: number; p: LngLat }>(0.0005, (o) => o.p)
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const [nid, p] of usedNodes) {
    nodeIndex.add({ id: nid, p })
    if (p[0] < minLng) minLng = p[0]
    if (p[0] > maxLng) maxLng = p[0]
    if (p[1] < minLat) minLat = p[1]
    if (p[1] > maxLat) maxLat = p[1]
  }

  const nearestNode = (q: LatLng): number | null => {
    const qp: LngLat = [q.lng, q.lat]
    for (let r = 1; r <= 6; r++) {
      let best: { id: number; d: number } | null = null
      for (const o of nodeIndex.near(qp, r)) {
        const d = distLngLat(qp, o.p)
        if (!best || d < best.d) best = { id: o.id, d }
      }
      if (best) return best.id
    }
    return null
  }

  return { nodes: usedNodes, adj, edges, bounds: { minLng, minLat, maxLng, maxLat }, nearestNode, sidewalkCount, demo: !!osm.meta.demo }
}
