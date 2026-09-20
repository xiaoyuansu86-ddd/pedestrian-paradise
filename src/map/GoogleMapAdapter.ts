import { setOptions, importLibrary } from '@googlemaps/js-api-loader'
import type { LatLng, LngLat, ViewMode } from '../types'
import type { MapAdapter, MarkerSpec, RouteLayer } from './MapAdapter'
import { PALETTE } from './MapAdapter'

/** Google Maps 客製調色，內容同專案根目錄 map color-new.txt（僅 raster 地圖／無 Map ID 時生效；有 Map ID 請在雲端樣式設定） */
const STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry.fill', stylers: [{ color: PALETTE.bg }] },
  { featureType: 'landscape.man_made', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway.controlled_access', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry.stroke', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'geometry.fill', stylers: [{ saturation: 85 }, { lightness: 95 }, { weight: 8 }] },
]

const MARKER_STYLE: Record<MarkerSpec['kind'], { bg: string; size: number; emoji: string }> = {
  origin: { bg: '#0f766e', size: 26, emoji: '' },
  dest: { bg: '#e11d48', size: 30, emoji: '📍' },
  poi: { bg: '#7c3aed', size: 26, emoji: '✨' },
  via: { bg: '#d97706', size: 26, emoji: '🛍️' },
  report: { bg: '#f59e0b', size: 22, emoji: '⚠️' },
  user: { bg: '#2563eb', size: 18, emoji: '' },
}

function removeMarker(m: google.maps.marker.AdvancedMarkerElement | google.maps.Marker) {
  if (m instanceof google.maps.Marker) m.setMap(null)
  else m.map = null
}

export class GoogleMapAdapter implements MapAdapter {
  readonly kind = 'google' as const
  private map: google.maps.Map | null = null
  private polylines = new Map<string, google.maps.Polyline[]>()
  private markers = new Map<string, google.maps.marker.AdvancedMarkerElement | google.maps.Marker>()
  private clickCb: ((p: LatLng) => void) | null = null
  private mapId: string | undefined
  private hasAdvanced = false
  private apiKey: string

  constructor(apiKey: string, mapId?: string) {
    this.apiKey = apiKey
    this.mapId = mapId || undefined
  }

  async mount(el: HTMLElement, center: LatLng, zoom: number) {
    setOptions({ key: this.apiKey, v: 'weekly', libraries: ['marker'] })
    const { Map } = (await importLibrary('maps')) as google.maps.MapsLibrary
    try {
      await importLibrary('marker')
      this.hasAdvanced = !!this.mapId
    } catch {
      this.hasAdvanced = false
    }
    this.map = new Map(el, {
      center,
      zoom,
      mapId: this.mapId,
      styles: this.mapId ? undefined : STYLES,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
      tilt: 0,
    })
    this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) this.clickCb?.({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    })
    this.map.data.setStyle({ fillColor: PALETTE.sidewalk, fillOpacity: 0.28, strokeColor: PALETTE.sidewalk, strokeWeight: 0.6, clickable: false })
  }

  destroy() {
    this.polylines.forEach((ps) => ps.forEach((p) => p.setMap(null)))
    this.markers.forEach((m) => removeMarker(m))
    this.map = null
  }

  setCenter(c: LatLng, zoom?: number) {
    this.map?.panTo(c)
    if (zoom !== undefined) this.map?.setZoom(zoom)
  }

  fitBounds(coords: LngLat[], padding = { top: 90, bottom: 330, left: 30, right: 30 }) {
    if (!this.map || !coords.length) return
    const b = new google.maps.LatLngBounds()
    coords.forEach(([lng, lat]) => b.extend({ lat, lng }))
    this.map.fitBounds(b, padding)
  }

  setViewMode(mode: ViewMode) {
    const map = this.map
    if (!map) return
    // 傾斜/旋轉需要向量地圖（Map ID）；raster 地圖會被忽略
    if (mode === '2d') {
      map.setTilt(0)
      map.setHeading(0)
    } else if (mode === 'iso') {
      map.setTilt(45)
      map.setHeading(-20)
    } else {
      map.setTilt(67.5)
      map.setHeading(-30)
    }
  }

  setRoutes(routes: RouteLayer[]) {
    const map = this.map
    if (!map) return
    this.polylines.forEach((ps) => ps.forEach((p) => p.setMap(null)))
    this.polylines.clear()
    const sorted = [...routes].sort((a, b) => Number(a.selected) - Number(b.selected))
    sorted.forEach((r, i) => {
      const path = r.coords.map(([lng, lat]) => ({ lat, lng }))
      const casing = new google.maps.Polyline({ path, map, strokeColor: '#ffffff', strokeWeight: r.selected ? 11 : 7, strokeOpacity: r.selected ? 0.95 : 0.6, zIndex: 10 + i * 2 })
      const line = new google.maps.Polyline({ path, map, strokeColor: r.color, strokeWeight: r.selected ? 7 : 4, strokeOpacity: r.selected ? 1 : 0.55, zIndex: 11 + i * 2 })
      this.polylines.set(r.id, [casing, line])
    })
  }

  setMarkers(markers: MarkerSpec[]) {
    const map = this.map
    if (!map) return
    const keep = new Set(markers.map((m) => m.id))
    for (const [id, m] of this.markers) {
      if (!keep.has(id)) {
        removeMarker(m)
        this.markers.delete(id)
      }
    }
    for (const spec of markers) {
      const existing = this.markers.get(spec.id)
      if (existing) {
        if ('position' in existing && !('setPosition' in existing)) existing.position = spec.pos
        else (existing as google.maps.Marker).setPosition(spec.pos)
        continue
      }
      const st = MARKER_STYLE[spec.kind]
      if (this.hasAdvanced) {
        const el = document.createElement('div')
        el.style.cssText = `width:${st.size}px;height:${st.size}px;border-radius:50%;background:${spec.color ?? st.bg};border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:${st.size * 0.55}px;line-height:1;`
        el.textContent = spec.emoji ?? st.emoji
        const m = new google.maps.marker.AdvancedMarkerElement({ map, position: spec.pos, content: el, title: spec.label })
        this.markers.set(spec.id, m)
      } else {
        const m = new google.maps.Marker({
          map,
          position: spec.pos,
          title: spec.label,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: st.size / 2.4,
            fillColor: spec.color ?? st.bg,
            fillOpacity: 1,
            strokeColor: '#fff',
            strokeWeight: 2.5,
          },
          label: spec.emoji ?? st.emoji ? { text: spec.emoji ?? st.emoji, fontSize: `${st.size * 0.5}px` } : undefined,
        })
        this.markers.set(spec.id, m)
      }
    }
  }

  setSidewalks(geojson: GeoJSON.FeatureCollection | null) {
    const map = this.map
    if (!map) return
    map.data.forEach((f: google.maps.Data.Feature) => map.data.remove(f))
    if (geojson) map.data.addGeoJson(geojson)
  }

  onClick(cb: (p: LatLng) => void) {
    this.clickCb = cb
  }
}
