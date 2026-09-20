import type { Edge, Graph, LatLng, LngLat, NeedKey, NeedProfile, Poi, RouteOption, RouteStats } from '../types'
import { angleDiff, fmtDistance, haversine, lineLength } from './geo'
import type { SunPosition } from './sun'
import { NEED_LABEL } from './needs'
import { poisForDetour } from './pois'

const WALK_M_PER_MIN = 75 // ≈ 4.5 km/h

export interface RouteContext {
  sun: SunPosition
  now: Date
}

/** 三種嚴格度的路線側寫 */
const PROFILES: { id: RouteOption['id']; label: string; tagline: string; color: string; strict: number }[] = [
  { id: 'A', label: '最貼近需求', tagline: '把你的每一項需求放在第一位', color: '#c4f3c4', strict: 1.0 },
  { id: 'B', label: '平衡路線', tagline: '兼顧需求與距離', color: '#5c3a1e', strict: 0.4 },
  { id: 'C', label: '最快抵達', tagline: '距離優先，基本安全仍保留', color: '#475569', strict: 0.12 },
]

/**
 * 每項需求對單一路段的「懲罰係數」p ≥ 1（1 = 完全符合），以及可選的 bonus < 1。
 * 對應《桃園人行道評估彙整》AHP 權重：淨寬 0.188、鋪面 0.164、無障礙 0.163、照明 0.084、遮蔽 0.05。
 */
function needPenalty(need: NeedKey, e: Edge, ctx: RouteContext): number {
  const a = e.attrs
  const rep = a.reports
  switch (need) {
    case 'sidewalk': {
      if (a.pedestrianOnly) return 1
      if (a.sidewalk === 'yes') return rep.includes('arcade_blocked') ? 2.5 : 1
      if (a.sidewalk === 'no') return a.traffic === 3 ? 6 : a.traffic === 2 ? 3.5 : 1.8
      return a.traffic === 2 ? 2 : 1.4 // unknown
    }
    case 'noSteps':
      return a.steps ? 40 : 1
    case 'smooth': {
      let p = a.surface === 2 ? 5 : a.surface === 1 ? 1.8 : 1
      if (rep.includes('pothole')) p *= 6
      if (rep.includes('arcade_blocked')) p *= 2
      return p
    }
    case 'wheelchair': {
      if (a.steps) return 100
      let p = 1
      if (a.netWidth !== undefined) {
        if (a.netWidth < 0.9) p *= 8
        else if (a.netWidth < 1.5) p *= 2.5
      }
      if (a.ramps === 0) p *= 2.2
      if (a.sidewalk === 'no' && a.traffic >= 2) p *= 6
      if (a.sidewalk === 'unknown' && a.traffic >= 2) p *= 2
      if (a.surface === 2) p *= 6
      if (rep.includes('no_ramp')) p *= 8
      if (rep.includes('pothole')) p *= 5
      if (rep.includes('narrow') || rep.includes('arcade_blocked')) p *= 4
      return p
    }
    case 'stroller': {
      if (a.steps) return 12
      let p = 1
      if (a.netWidth !== undefined && a.netWidth < 1.2) p *= 2.5
      if (a.ramps === 0) p *= 1.6
      if (a.sidewalk === 'no' && a.traffic >= 2) p *= 4
      if (a.surface === 2) p *= 3
      if (rep.includes('pothole') || rep.includes('no_ramp')) p *= 4
      if (rep.includes('arcade_blocked') || rep.includes('narrow')) p *= 3
      return p
    }
    case 'luggage': {
      if (a.steps) return 15
      let p = 1
      if (a.surface === 2) p *= 4
      if (a.surface === 1) p *= 1.5
      if (a.netWidth !== undefined && a.netWidth < 1.2) p *= 2
      if (rep.includes('pothole')) p *= 4
      if (rep.includes('arcade_blocked') || rep.includes('narrow')) p *= 2.5
      return p
    }
    case 'shade': {
      if (ctx.sun.altitude < 5) return 1 // 夜間無差
      const strength = Math.min(1, ctx.sun.altitude / 60) // 太陽越高越熱
      return 1 + (1 - a.shade) * 4 * (0.5 + 0.5 * strength)
    }
    case 'noGlare': {
      const s = ctx.sun
      if (s.altitude < 0 || s.altitude > 40 || a.covered) return 1
      const diff = angleDiff(e.bearing, s.azimuth)
      if (diff < 20) return 7
      if (diff < 40) return 3
      return 1
    }
    case 'lit': {
      if (a.lit === true) return 1
      if (a.lit === false) return 4
      if (rep.includes('dark')) return 4
      // 未標註：大馬路通常有燈
      return a.traffic === 3 ? 1.1 : a.traffic === 2 ? 1.4 : a.pedestrianOnly ? 2.4 : 1.7
    }
    case 'quiet':
      return a.traffic === 3 ? 4 : a.traffic === 2 ? 2 : 1
    case 'kids': {
      let p = a.traffic === 3 ? (a.sidewalk === 'yes' ? 2.5 : 8) : a.traffic === 2 ? 1.8 : 1
      if (a.park) p *= 0.85
      return p
    }
    case 'stroll': {
      let p = a.traffic === 3 ? 3 : a.traffic === 2 ? 1.6 : 1
      if (a.pedestrianOnly || a.park) p *= 0.75
      return p
    }
    case 'explore': {
      let p = a.traffic === 3 ? 2 : 1
      if (a.culture > 0) p *= Math.max(0.5, 1 - a.culture * 0.2)
      if (a.pedestrianOnly) p *= 0.9
      return p
    }
    case 'fast':
      return 1
  }
}

function edgeCost(e: Edge, needs: NeedKey[], strict: number, ctx: RouteContext, avoid?: Set<number>): number {
  let extra = 0
  let bonus = 1
  for (const n of needs) {
    const p = needPenalty(n, e, ctx)
    if (p >= 1) extra += p - 1
    else bonus *= p
  }
  // 基礎安全永遠保留一點權重（C 路線也不會走沒有人行道的大馬路）
  if (!needs.includes('sidewalk')) extra += (needPenalty('sidewalk', e, ctx) - 1) * 0.25
  let m = (1 + extra * strict) * (1 - (1 - bonus) * strict)
  if (avoid && avoid.has(e.id)) m *= 1.7
  return e.len * m
}

// ---- 二元堆 ----
class MinHeap {
  private a: { k: number; v: number }[] = []
  get size() {
    return this.a.length
  }
  push(k: number, v: number) {
    const a = this.a
    a.push({ k, v })
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].k <= a[i].k) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop() {
    const a = this.a
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1,
          r = l + 1
        let m = i
        if (l < a.length && a[l].k < a[m].k) m = l
        if (r < a.length && a[r].k < a[m].k) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
}

interface DijkstraResult {
  dist: Map<number, number>
  prev: Map<number, Edge>
}

function dijkstra(g: Graph, src: number, needs: NeedKey[], strict: number, ctx: RouteContext, avoid?: Set<number>, target?: number): DijkstraResult {
  const dist = new Map<number, number>()
  const prev = new Map<number, Edge>()
  const heap = new MinHeap()
  dist.set(src, 0)
  heap.push(0, src)
  while (heap.size) {
    const { k, v } = heap.pop()
    if (k > (dist.get(v) ?? Infinity)) continue
    if (target !== undefined && v === target) break
    const out = g.adj.get(v)
    if (!out) continue
    for (const e of out) {
      const nd = k + edgeCost(e, needs, strict, ctx, avoid)
      if (nd < (dist.get(e.to) ?? Infinity)) {
        dist.set(e.to, nd)
        prev.set(e.to, e)
        heap.push(nd, e.to)
      }
    }
  }
  return { dist, prev }
}

function pathEdges(res: DijkstraResult, src: number, dst: number): Edge[] | null {
  if (!res.dist.has(dst)) return null
  const out: Edge[] = []
  let cur = dst
  while (cur !== src) {
    const e = res.prev.get(cur)
    if (!e) return null
    out.push(e)
    cur = e.from
  }
  return out.reverse()
}

function edgesToCoords(edges: Edge[]): LngLat[] {
  const c: LngLat[] = []
  edges.forEach((e, i) => {
    if (i === 0) c.push(e.coords[0])
    c.push(e.coords[1])
  })
  return c
}

function computeStats(edges: Edge[]): RouteStats {
  const total = edges.reduce((s, e) => s + e.len, 0) || 1
  let sw = 0, lit = 0, shade = 0, high = 0, poor = 0, wide = 0, swLen = 0
  let steps = 0
  let prevSteps = false
  for (const e of edges) {
    const a = e.attrs
    if (a.sidewalk === 'yes' || a.pedestrianOnly) sw += e.len
    if (a.lit === true || (a.lit === null && a.traffic === 3)) lit += e.len
    shade += a.shade * e.len
    if (a.traffic === 3) high += e.len
    if (a.surface === 2 || a.reports.includes('pothole')) poor += e.len
    if (a.netWidth !== undefined) {
      swLen += e.len
      if (a.netWidth >= 1.5) wide += e.len
    }
    if (a.steps && !prevSteps) steps++
    prevSteps = a.steps
  }
  return {
    sidewalkPct: Math.round((sw / total) * 100),
    stepsCount: steps,
    litPct: Math.round((lit / total) * 100),
    shadeIdx: shade / total,
    highTrafficPct: Math.round((high / total) * 100),
    poorSurfaceM: Math.round(poor),
    wideNetPct: swLen ? Math.round((wide / swLen) * 100) : -1,
  }
}

/** 需求符合度：每項需求取「長度加權的 1/p」平均 */
function scoreRoute(edges: Edge[], needs: NeedKey[], ctx: RouteContext) {
  const total = edges.reduce((s, e) => s + e.len, 0) || 1
  const needScores: Partial<Record<NeedKey, number>> = {}
  const list = needs.filter((n) => n !== 'fast')
  for (const n of list) {
    let s = 0
    for (const e of edges) {
      const p = needPenalty(n, e, ctx)
      s += (p >= 1 ? 1 / p : 1) * e.len
    }
    needScores[n] = s / total
  }
  const vals = Object.values(needScores) as number[]
  const match = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 1
  return { needScores, match: Math.round(match * 100) }
}

function explain(stats: RouteStats, needs: NeedKey[], via: Poi[], distance: number, ctx: RouteContext): string[] {
  const out: string[] = []
  out.push(`${stats.sidewalkPct}% 路段有人行道或人行專用道`)
  if (needs.includes('noSteps') || needs.includes('wheelchair') || needs.includes('stroller') || needs.includes('luggage'))
    out.push(stats.stepsCount === 0 ? '全程無階梯' : `含 ${stats.stepsCount} 段階梯`)
  if (needs.includes('wheelchair') || needs.includes('stroller'))
    out.push(stats.wideNetPct >= 0 ? `官方圖資人行道淨寬 ≥1.5m 佔 ${stats.wideNetPct}%` : '此段無官方人行道淨寬資料，以道路等級推估')
  if (needs.includes('smooth') || needs.includes('luggage'))
    out.push(stats.poorSurfaceM === 0 ? '無已知不平整或坑洞回報路段' : `約 ${stats.poorSurfaceM} m 路面較差／有坑洞回報`)
  if (needs.includes('shade')) out.push(`遮蔭指數 ${stats.shadeIdx >= 0.6 ? '高' : stats.shadeIdx >= 0.4 ? '中' : '低'}（${Math.round(stats.shadeIdx * 100)}）`)
  if (needs.includes('noGlare')) out.push(ctx.sun.altitude < 0 ? '目前為夜間，無逆光' : `已避開朝太陽方向（方位 ${Math.round(ctx.sun.azimuth)}°）的長直路段`)
  if (needs.includes('lit')) out.push(`${stats.litPct}% 路段有照明標註或為主要道路`)
  if (needs.includes('quiet') || needs.includes('kids') || needs.includes('stroll')) out.push(`${stats.highTrafficPct}% 路段沿大馬路`)
  for (const p of via) out.push(`順路繞經 ${p.name}`)
  if (out.length < 3) out.push(`全程 ${fmtDistance(distance)}`)
  return out.slice(0, 5)
}

export interface PlanInput {
  graph: Graph
  origin: LatLng
  destination: LatLng
  profile: NeedProfile
  pois: Poi[]
  ctx: RouteContext
}

/** 主要入口：產生三條分級路線 */
export function planRoutes(input: PlanInput): RouteOption[] {
  const { graph: g, origin, destination, profile, pois, ctx } = input
  const src = g.nearestNode(origin)
  const dst = g.nearestNode(destination)
  if (src === null || dst === null) return []
  const needs = profile.needs.length ? profile.needs : ['sidewalk' as NeedKey]

  const results: RouteOption[] = []
  const seen: string[] = []
  let avoid: Set<number> | undefined

  for (const pf of PROFILES) {
    const strict = needs.includes('fast') ? Math.min(pf.strict, 0.3) : pf.strict
    // 順路繞徑：沿途店家以 dO + dD 最小者為準
    let waypoints: { node: number; poi: Poi }[] = []
    if (profile.detours.length && pf.id !== 'C') {
      const fromO = dijkstra(g, src, needs, strict, ctx)
      const fromD = dijkstra(g, dst, needs, strict, ctx)
      const direct = fromO.dist.get(dst) ?? Infinity
      for (const kind of profile.detours) {
        let best: { node: number; poi: Poi; cost: number } | null = null
        for (const poi of poisForDetour(pois, kind)) {
          const n = g.nearestNode(poi)
          if (n === null) continue
          const c = (fromO.dist.get(n) ?? Infinity) + (fromD.dist.get(n) ?? Infinity)
          if (c < direct * 1.8 + 500 && (!best || c < best.cost)) best = { node: n, poi, cost: c }
        }
        if (best) waypoints.push(best)
      }
      // 依離起點距離排序
      waypoints.sort((a, b) => (fromO.dist.get(a.node) ?? 0) - (fromO.dist.get(b.node) ?? 0))
    }

    const seq = [src, ...waypoints.map((w) => w.node), dst]
    const edges: Edge[] = []
    let ok = true
    for (let i = 1; i < seq.length; i++) {
      const r = dijkstra(g, seq[i - 1], needs, strict, ctx, avoid, seq[i])
      const pe = pathEdges(r, seq[i - 1], seq[i])
      if (!pe) {
        ok = false
        break
      }
      edges.push(...pe)
    }
    if (!ok || edges.length === 0) continue

    const key = edges.map((e) => e.id).join(',')
    if (seen.includes(key)) {
      // 與前一條完全相同 → 用避開前一條的方式再算一次求多樣性
      avoid = new Set(edges.map((e) => e.id))
      const r = dijkstra(g, src, needs, strict, ctx, avoid, dst)
      const pe = pathEdges(r, src, dst)
      if (pe && !seen.includes(pe.map((e) => e.id).join(','))) {
        edges.length = 0
        edges.push(...pe)
        waypoints = []
      } else continue
    }
    seen.push(edges.map((e) => e.id).join(','))
    avoid = new Set(edges.map((e) => e.id))

    const coords = edgesToCoords(edges)
    // 首尾接上實際起終點
    coords.unshift([origin.lng, origin.lat])
    coords.push([destination.lng, destination.lat])
    const distance = lineLength(coords)
    const stats = computeStats(edges)
    const { needScores, match } = scoreRoute(edges, needs, ctx)
    const via = waypoints.map((w) => w.poi)
    results.push({
      id: pf.id,
      label: pf.label,
      tagline: pf.tagline,
      color: pf.color,
      coords,
      distance,
      minutes: distance / WALK_M_PER_MIN + (stats.stepsCount * 0.5),
      match,
      needScores,
      explanations: explain(stats, needs, via, distance, ctx),
      via,
      edges,
      stats,
    })
  }
  // 依符合度排序（同分則短者優先）
  results.sort((a, b) => b.match - a.match || a.distance - b.distance)
  return results
}

export function straightLine(o: LatLng, d: LatLng) {
  return haversine(o, d)
}

export { NEED_LABEL }
