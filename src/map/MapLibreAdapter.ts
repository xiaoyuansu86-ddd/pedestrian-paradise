import { Map as MLMap, Marker, LngLatBounds, type StyleSpecification, type GeoJSONSource, type MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { LatLng, LngLat, ViewMode } from '../types'
import type { MapAdapter, MarkerSpec, RouteLayer } from './MapAdapter'
import { PALETTE, buildMarkerElement } from './MapAdapter'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/bright'

const MARKER_STYLE: Record<MarkerSpec['kind'], { bg: string; size: number; emoji: string }> = {
  origin: { bg: '#0f766e', size: 26, emoji: '●' },
  dest: { bg: '#e11d48', size: 30, emoji: '📍' },
  poi: { bg: '#7c3aed', size: 26, emoji: '✨' },
  via: { bg: '#d97706', size: 26, emoji: '🛍️' },
  report: { bg: '#f59e0b', size: 22, emoji: '⚠️' },
  user: { bg: '#2563eb', size: 18, emoji: '' },
}

export class MapLibreAdapter implements MapAdapter {
  readonly kind = 'osm' as const
  private map: MLMap | null = null
  private markers = new Map<string, Marker>()
  private clickCb: ((p: LatLng) => void) | null = null
  private pendingRoutes: RouteLayer[] = []
  private pendingSidewalks: GeoJSON.FeatureCollection | null = null
  private loaded = false

  async mount(el: HTMLElement, center: LatLng, zoom: number) {
    const map = new MLMap({
      container: el,
      style: STYLE_URL,
      center: [center.lng, center.lat],
      zoom,
      pitch: 0,
      attributionControl: { compact: true },
      maxPitch: 70,
    })
    this.map = map
    map.on('click', (e: MapMouseEvent) => this.clickCb?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }))
    await new Promise<void>((resolve) => {
      map.once('load', () => {
        this.loaded = true
        this.recolor()
        this.ensureLayers()
        this.setRoutes(this.pendingRoutes)
        this.setSidewalks(this.pendingSidewalks)
        resolve()
      })
      map.once('error', () => resolve())
    })
  }

  /** 客製化色彩（對應 map color-new.txt 的 Google 樣式）：單一淺藍灰底、巷道近白加粗、建物／POI／高速公路隱藏 */
  private recolor() {
    const map = this.map!
    const style = map.getStyle() as StyleSpecification
    for (const layer of style.layers) {
      const id = layer.id
      try {
        if (layer.type === 'background') map.setPaintProperty(id, 'background-color', PALETTE.bg)
        else if (id.includes('water') && layer.type === 'fill') map.setPaintProperty(id, 'fill-color', PALETTE.water)
        else if ((id.includes('park') || id.includes('landuse') || id.includes('grass') || id.includes('wood')) && layer.type === 'fill')
          map.setPaintProperty(id, 'fill-color', PALETTE.park)
        else if (id.includes('building') && layer.type === 'fill') {
          map.setLayoutProperty(id, 'visibility', 'none')
        } else if (id.startsWith('road') || id.startsWith('highway') || id.includes('street') || id.includes('bridge') || id.includes('tunnel')) {
          if (layer.type === 'line') {
            if (id.includes('motorway') || id.includes('trunk')) {
              map.setLayoutProperty(id, 'visibility', 'none')
            } else if (id.includes('primary') || id.includes('secondary')) {
              if (!id.includes('casing')) map.setPaintProperty(id, 'line-color', PALETTE.roadMajor)
            } else if (id.includes('path') || id.includes('footway') || id.includes('pedestrian')) {
              map.setPaintProperty(id, 'line-color', '#9fd3c7')
            } else if (!id.includes('casing')) {
              map.setPaintProperty(id, 'line-color', PALETTE.road)
              map.setPaintProperty(id, 'line-width', ['interpolate', ['exponential', 1.4], ['zoom'], 13, 2, 16, 8, 19, 20])
            }
          }
        } else if (layer.type === 'symbol' && id.includes('poi')) {
          map.setLayoutProperty(id, 'visibility', 'none')
        } else if (layer.type === 'symbol' && id.includes('label')) {
          map.setPaintProperty(id, 'text-color', PALETTE.label)
        }
      } catch {
        /* 某些圖層不支援該屬性 */
      }
    }
    // 3D 建物（等角 / 3D 模式時顯示）
    if (!map.getLayer('pp-3d-buildings') && map.getSource('openmaptiles')) {
      const firstLabel = style.layers.find((l) => l.type === 'symbol')?.id
      map.addLayer(
        {
          id: 'pp-3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': '#e6dfd2',
            'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 12],
            'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
            'fill-extrusion-opacity': 0.85,
          },
          layout: { visibility: 'none' },
        },
        firstLabel,
      )
    }
  }

  private ensureLayers() {
    const map = this.map!
    if (!map.getSource('pp-sidewalks')) {
      map.addSource('pp-sidewalks', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'pp-sidewalks-fill',
        type: 'fill',
        source: 'pp-sidewalks',
        paint: { 'fill-color': PALETTE.sidewalk, 'fill-opacity': 0.28 },
      })
      map.addLayer({
        id: 'pp-sidewalks-line',
        type: 'line',
        source: 'pp-sidewalks',
        paint: { 'line-color': PALETTE.sidewalk, 'line-width': 0.6, 'line-opacity': 0.6 },
      })
    }
    if (!map.getSource('pp-routes')) {
      map.addSource('pp-routes', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({
        id: 'pp-routes-casing',
        type: 'line',
        source: 'pp-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['case', ['get', 'selected'], 11, 7],
          'line-opacity': ['case', ['get', 'selected'], 0.95, 0.6],
        },
      })
      map.addLayer({
        id: 'pp-routes-line',
        type: 'line',
        source: 'pp-routes',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['case', ['get', 'selected'], 7, 4],
          'line-opacity': ['case', ['get', 'selected'], 1, 0.55],
        },
      })
    }
  }

  destroy() {
    this.markers.forEach((m) => m.remove())
    this.markers.clear()
    this.map?.remove()
    this.map = null
  }

  setCenter(c: LatLng, zoom?: number) {
    this.map?.easeTo({ center: [c.lng, c.lat], zoom: zoom ?? this.map.getZoom(), duration: 600 })
  }

  fitBounds(coords: LngLat[], padding = { top: 90, bottom: 330, left: 30, right: 30 }) {
    if (!this.map || coords.length === 0) return
    const b = new LngLatBounds(coords[0], coords[0])
    coords.forEach((c) => b.extend(c))
    this.map.fitBounds(b, { padding, duration: 700, maxZoom: 17.5 })
  }

  setViewMode(mode: ViewMode) {
    const map = this.map
    if (!map) return
    const vis = mode === '2d' ? 'none' : 'visible'
    if (map.getLayer('pp-3d-buildings')) map.setLayoutProperty('pp-3d-buildings', 'visibility', vis)
    if (mode === '2d') map.easeTo({ pitch: 0, bearing: 0, duration: 600 })
    else if (mode === 'iso') map.easeTo({ pitch: 45, bearing: -20, duration: 700 })
    else map.easeTo({ pitch: 62, bearing: -30, duration: 800 })
  }

  setRoutes(routes: RouteLayer[]) {
    this.pendingRoutes = routes
    const map = this.map
    if (!map || !this.loaded) return
    const src = map.getSource('pp-routes') as GeoJSONSource | undefined
    // 被選取的畫在最上面
    const sorted = [...routes].sort((a, b) => Number(a.selected) - Number(b.selected))
    src?.setData({
      type: 'FeatureCollection',
      features: sorted.map((r) => ({
        type: 'Feature',
        properties: { id: r.id, color: r.color, selected: r.selected },
        geometry: { type: 'LineString', coordinates: r.coords },
      })),
    })
  }

  setMarkers(markers: MarkerSpec[]) {
    const map = this.map
    if (!map) return
    const keep = new Set(markers.map((m) => m.id))
    for (const [id, m] of this.markers) {
      if (!keep.has(id)) {
        m.remove()
        this.markers.delete(id)
      }
    }
    for (const spec of markers) {
      let m = this.markers.get(spec.id)
      if (!m) {
        const el = buildMarkerElement(spec, MARKER_STYLE[spec.kind])
        m = new Marker({ element: el, anchor: 'center' }).setLngLat([spec.pos.lng, spec.pos.lat]).addTo(map)
        this.markers.set(spec.id, m)
      } else m.setLngLat([spec.pos.lng, spec.pos.lat])
    }
  }

  setSidewalks(geojson: GeoJSON.FeatureCollection | null) {
    this.pendingSidewalks = geojson
    const map = this.map
    if (!map || !this.loaded) return
    const src = map.getSource('pp-sidewalks') as GeoJSONSource | undefined
    src?.setData(geojson ?? { type: 'FeatureCollection', features: [] })
  }

  onClick(cb: (p: LatLng) => void) {
    this.clickCb = cb
  }
}
