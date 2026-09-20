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
