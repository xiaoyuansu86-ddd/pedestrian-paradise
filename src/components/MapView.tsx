import { useEffect, useRef } from 'react'
import type { LatLng, LngLat, ViewMode } from '../types'
import type { MapAdapter, MarkerSpec, RouteLayer } from '../map/MapAdapter'
import { createAdapter } from '../map/createAdapter'

interface Props {
  center: LatLng
  routes: RouteLayer[]
  markers: MarkerSpec[]
  sidewalks: GeoJSON.FeatureCollection | null
  showSidewalks: boolean
  viewMode: ViewMode
  fitTo: LngLat[] | null
  fitKey: string
  onClick: (p: LatLng) => void
  onReady: (kind: 'google' | 'osm') => void
  onMapError?: (msg: string) => void
}

declare global {
  interface Window {
    gm_authFailure?: () => void
  }
}

export function MapView({ center, routes, markers, sidewalks, showSidewalks, viewMode, fitTo, fitKey, onClick, onReady, onMapError }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const adapter = useRef<MapAdapter | null>(null)
  const ready = useRef(false)
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  useEffect(() => {
    let cancelled = false
    const el = ref.current
    const mountAdapter = async (a: MapAdapter) => {
      if (cancelled || !el) return
      el.innerHTML = ''
      await a.mount(el, center, 15.5)
      if (cancelled) {
        a.destroy()
        return
      }
      a.onClick((p) => clickRef.current(p))
      a.setRoutes(routes)
      a.setMarkers(markers)
      a.setSidewalks(showSidewalks ? sidewalks : null)
      adapter.current = a
      ready.current = true
      onReady(a.kind)
    }
    // Google 金鑰驗證失敗（referrer / API 未啟用 / 帳單）→ 無縫退回 OSM 底圖
    window.gm_authFailure = async () => {
      onMapError?.('Google 底圖金鑰驗證失敗（請檢查 Maps JavaScript API 是否啟用、referrer 限制、帳單），已切換 OSM 底圖')
      adapter.current?.destroy()
      adapter.current = null
      const { MapLibreAdapter } = await import('../map/MapLibreAdapter')
      await mountAdapter(new MapLibreAdapter())
    }
    ;(async () => {
      try {
        await mountAdapter(await createAdapter())
      } catch (e) {
        onMapError?.(`底圖載入失敗：${(e as Error).message}，改用 OSM 底圖`)
        const { MapLibreAdapter } = await import('../map/MapLibreAdapter')
        await mountAdapter(new MapLibreAdapter())
      }
    })()
    return () => {
      cancelled = true
      window.gm_authFailure = undefined
      adapter.current?.destroy()
      adapter.current = null
      ready.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    adapter.current?.setRoutes(routes)
  }, [routes])
  useEffect(() => {
    adapter.current?.setMarkers(markers)
  }, [markers])
  useEffect(() => {
    adapter.current?.setSidewalks(showSidewalks ? sidewalks : null)
  }, [sidewalks, showSidewalks])
  useEffect(() => {
    adapter.current?.setViewMode(viewMode)
  }, [viewMode])
  useEffect(() => {
    if (fitTo && fitTo.length > 1) adapter.current?.fitBounds(fitTo)
    else if (fitTo && fitTo.length === 1) adapter.current?.setCenter({ lng: fitTo[0][0], lat: fitTo[0][1] }, 16.5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey])

  return <div ref={ref} className="absolute inset-0" />
}
