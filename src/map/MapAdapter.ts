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

export const PALETTE = {
  bg: '#f7f5f0',
  water: '#cfe6e3',
  park: '#d9ead3',
  road: '#ffffff',
  roadMajor: '#f3e8d2',
  building: '#ece7dd',
  label: '#5b5b5b',
  sidewalk: '#0f766e',
}
