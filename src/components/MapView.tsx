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
}

export function MapView({ center, routes, markers, sidewalks, showSidewalks, viewMode, fitTo, fitKey, onClick, onReady }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const adapter = useRef<MapAdapter | null>(null)
  const ready = useRef(false)
  const clickRef = useRef(onClick)
  clickRef.current = onClick

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const a = await createAdapter()
      if (cancelled || !ref.current) return
      await a.mount(ref.current, center, 15.5)
      if (cancelled) {
        a.destroy()
        return
      }
      a.onClick((p) => clickRef.current(p))
      adapter.current = a
      ready.current = true
      onReady(a.kind)
    })()
    return () => {
      cancelled = true
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
