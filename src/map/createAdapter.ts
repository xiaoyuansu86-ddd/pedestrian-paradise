import type { MapAdapter } from './MapAdapter'

export const GOOGLE_KEY: string = (import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined) ?? ''
export const GOOGLE_MAP_ID: string = (import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined) ?? ''

/** 有 Google 金鑰就用 Google Maps JS；沒有就退回 MapLibre + OpenFreeMap（OSM） */
export async function createAdapter(): Promise<MapAdapter> {
  if (GOOGLE_KEY) {
    const { GoogleMapAdapter } = await import('./GoogleMapAdapter')
    return new GoogleMapAdapter(GOOGLE_KEY, GOOGLE_MAP_ID)
  }
  const { MapLibreAdapter } = await import('./MapLibreAdapter')
  return new MapLibreAdapter()
}
