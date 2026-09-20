import type { LatLng, LngLat, ViewMode } from '../types'

export interface RouteLayer {
  id: string
  coords: LngLat[]
  color: string
  selected: boolean
}

export type MarkerKind = 'origin' | 'dest' | 'poi' | 'report' | 'user' | 'via'
export interface MarkerSpec {
  id: string
  pos: LatLng
  kind: MarkerKind
  label?: string
  emoji?: string
  color?: string
  /** 常駐顯示在圖釘下方的文字（如店名）；未設定時只在 hover / title 顯示 label */
  caption?: string
  /** caption 下方的小字（如「飲料店 · 距路線 30 m」） */
  sub?: string
}

/** 地圖底層抽象：Google Maps JS 與 MapLibre（OSM）共用同一組操作 */
export interface MapAdapter {
  readonly kind: 'google' | 'osm'
  mount(el: HTMLElement, center: LatLng, zoom: number): Promise<void>
  destroy(): void
  setCenter(c: LatLng, zoom?: number): void
  fitBounds(coords: LngLat[], padding?: { top: number; bottom: number; left: number; right: number }): void
  setViewMode(mode: ViewMode): void
  setRoutes(routes: RouteLayer[]): void
  setMarkers(markers: MarkerSpec[]): void
  setSidewalks(geojson: GeoJSON.FeatureCollection | null): void
  onClick(cb: (p: LatLng) => void): void
}

/** 建立圓形圖釘 DOM；有 caption 時在圖釘下方常駐顯示白底名稱卡（Google Advanced Marker 與 MapLibre 共用） */
export function buildMarkerElement(spec: MarkerSpec, st: { bg: string; size: number; emoji: string }): HTMLElement {
  const el = document.createElement('div')
  el.className = 'pp-marker'
  el.style.cssText = `position:relative;width:${st.size}px;height:${st.size}px;border-radius:50%;background:${spec.color ?? st.bg};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:${st.size * 0.55}px;line-height:1;cursor:pointer;`
  if (spec.kind === 'user') el.style.cssText += 'box-shadow:0 0 0 8px rgba(37,99,235,.2);'
  el.textContent = spec.emoji ?? (spec.kind === 'origin' || spec.kind === 'user' ? '' : st.emoji)
  if (spec.label) el.title = spec.label
  if (spec.caption) {
    const cap = document.createElement('div')
    cap.style.cssText = `position:absolute;top:calc(100% + 3px);left:50%;transform:translateX(-50%);background:#fff;color:#2b2823;border:1.5px solid ${spec.color ?? st.bg};border-radius:8px;padding:2px 6px;box-shadow:0 1px 4px rgba(0,0,0,.18);white-space:nowrap;text-align:center;line-height:1.25;pointer-events:none;`
    const name = document.createElement('div')
    name.style.cssText = 'font-size:11px;font-weight:600;max-width:140px;overflow:hidden;text-overflow:ellipsis;'
    name.textContent = spec.caption
    cap.appendChild(name)
    if (spec.sub) {
      const sub = document.createElement('div')
      sub.style.cssText = 'font-size:9px;color:#6b6357;font-weight:400;'
      sub.textContent = spec.sub
      cap.appendChild(sub)
    }
    el.appendChild(cap)
  }
  return el
}

/** 依 map color-new.txt：全圖單一淺藍灰底，巷道近白且加粗，建物／POI／高速公路隱藏 */
export const PALETTE = {
  bg: '#dbeaeb',
  water: '#dbeaeb',
  park: '#dbeaeb',
  road: '#f4fafa',
  roadMajor: '#cddfe0',
  building: '#dbeaeb',
  label: '#5b5b5b',
  sidewalk: '#0f766e',
}
