import type { LatLng, LngLat } from '../types'

const R = 6371000
const D2R = Math.PI / 180

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * D2R
  const dLng = (b.lng - a.lng) * D2R
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

export function distLngLat(a: LngLat, b: LngLat): number {
  return haversine({ lng: a[0], lat: a[1] }, { lng: b[0], lat: b[1] })
}

/** 方位角（度，0=北、90=東） */
export function bearing(a: LngLat, b: LngLat): number {
  const φ1 = a[1] * D2R
  const φ2 = b[1] * D2R
  const Δλ = (b[0] - a[0]) * D2R
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

export function angleDiff(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180)
  return d
}

export function toLatLng(p: LngLat): LatLng {
  return { lng: p[0], lat: p[1] }
}
export function toLngLat(p: LatLng): LngLat {
  return [p.lng, p.lat]
}

/** 以參考緯度做等距投影（公尺），供近距離幾何運算 */
export function projector(refLat: number) {
  const kx = Math.cos(refLat * D2R) * R * D2R
  const ky = R * D2R
  return {
    toXY(p: LngLat): [number, number] {
      return [p[0] * kx, p[1] * ky]
    },
  }
}

/** 點到線段的距離（公尺） */
export function pointToSegmentM(p: LngLat, a: LngLat, b: LngLat): number {
  const { toXY } = projector(p[1])
  const [px, py] = toXY(p)
  const [ax, ay] = toXY(a)
  const [bx, by] = toXY(b)
  const dx = bx - ax
  const dy = by - ay
  const l2 = dx * dx + dy * dy
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2
  t = Math.max(0, Math.min(1, t))
  const qx = ax + t * dx
  const qy = ay + t * dy
  return Math.hypot(px - qx, py - qy)
}

/** 點到折線的最小距離（公尺） */
export function pointToLineM(p: LngLat, line: LngLat[]): number {
  let best = Infinity
  for (let i = 1; i < line.length; i++) {
    const d = pointToSegmentM(p, line[i - 1], line[i])
    if (d < best) best = d
  }
  return best
}

export function lineLength(line: LngLat[]): number {
  let s = 0
  for (let i = 1; i < line.length; i++) s += distLngLat(line[i - 1], line[i])
  return s
}

export function boundsOf(coords: LngLat[]) {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity
  for (const [x, y] of coords) {
    if (x < minLng) minLng = x
    if (x > maxLng) maxLng = x
    if (y < minLat) minLat = y
    if (y > maxLat) maxLat = y
  }
  return { minLng, minLat, maxLng, maxLat }
}

/** 簡易格網索引：把點放進 cellSize（度）大小的格子 */
export class GridIndex<T> {
  private cells = new Map<string, T[]>()
  private cellDeg: number
  private getXY: (t: T) => LngLat
  constructor(cellDeg: number, getXY: (t: T) => LngLat) {
    this.cellDeg = cellDeg
    this.getXY = getXY
  }
  private key(x: number, y: number) {
    return `${Math.floor(x / this.cellDeg)}:${Math.floor(y / this.cellDeg)}`
  }
  add(t: T) {
    const [x, y] = this.getXY(t)
    const k = this.key(x, y)
    const arr = this.cells.get(k)
    if (arr) arr.push(t)
    else this.cells.set(k, [t])
  }
  /** 取得鄰近 (2r+1)^2 格內的所有項目 */
  near(p: LngLat, r = 1): T[] {
    const cx = Math.floor(p[0] / this.cellDeg)
    const cy = Math.floor(p[1] / this.cellDeg)
    const out: T[] = []
    for (let i = -r; i <= r; i++)
      for (let j = -r; j <= r; j++) {
        const arr = this.cells.get(`${cx + i}:${cy + j}`)
        if (arr) out.push(...arr)
      }
    return out
  }
}

export function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`
}
export function fmtMinutes(min: number): string {
  if (min < 1) return '<1 分'
  if (min < 60) return `${Math.round(min)} 分`
  const h = Math.floor(min / 60)
  return `${h} 小時 ${Math.round(min - h * 60)} 分`
}
