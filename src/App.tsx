import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Graph, LatLng, LngLat, NeedProfile, OsmData, Poi, Report, ReportType, RouteOption, Trip, ViewMode } from './types'
import { MapView } from './components/MapView'
import { TopBar } from './components/TopBar'
import { SearchPanel } from './components/SearchPanel'
import { NeedsSheet } from './components/NeedsSheet'
import { RouteOptions } from './components/RouteOptions'
import { NavigationView } from './components/NavigationView'
import { TripSummary } from './components/TripSummary'
import { SurpriseWheel } from './components/SurpriseWheel'
import { ReportModal } from './components/ReportModal'
import type { MarkerSpec, RouteLayer } from './map/MapAdapter'
import { TAOYUAN_STATION, loadDemoNetwork, loadLiveNetwork, loadSidewalks, type DataStatus } from './lib/data'
import { buildGraph, type SidewalkCollection } from './lib/network'
import { planRoutes } from './lib/router'
import { sunPosition } from './lib/sun'
import { highlightsAlong, mergePois, pickSurprise, type SurpriseTheme } from './lib/pois'
import { fetchSharedReports, loadLocalReports, mergeReports, newId, submitReport } from './lib/reports'
import { MotionSensor, type MotionStats } from './lib/motion'
import { haversine, lineLength } from './lib/geo'

type Step = 'input' | 'needs' | 'routes' | 'navigate' | 'summary'

const DEFAULT_PROFILE: NeedProfile = { needs: ['sidewalk'], detours: [], text: '', notes: [], source: 'preset' }

export default function App() {
  const [step, setStep] = useState<Step>('input')
  const [origin, setOrigin] = useState<LatLng>(TAOYUAN_STATION)
  const [originLabel, setOriginLabel] = useState('目前位置：桃園車站（示範起點）')
  const [destination, setDestination] = useState<{ pos: LatLng; name: string } | null>(null)
  const [profile, setProfile] = useState<NeedProfile>(DEFAULT_PROFILE)
  const [routes, setRoutes] = useState<RouteOption[]>([])
  const [selected, setSelected] = useState<RouteOption['id'] | null>(null)
  const [planning, setPlanning] = useState(false)
  const [trip, setTrip] = useState<Trip | null>(null)
  const [progress, setProgress] = useState(0)
  const [userPos, setUserPos] = useState<LatLng | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('2d')
  const [showSidewalks, setShowSidewalks] = useState(true)
  const [surpriseOpen, setSurpriseOpen] = useState(false)
  const [reportAt, setReportAt] = useState<LatLng | null>(null)
  const [fit, setFit] = useState<{ coords: LngLat[]; key: string }>({ coords: [], key: '' })

  const [osmPois, setOsmPois] = useState<Poi[]>([])
  const [sidewalks, setSidewalks] = useState<SidewalkCollection | null>(null)
  const [graph, setGraph] = useState<Graph | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [status, setStatus] = useState<DataStatus>({ network: 'loading', sidewalk: false, places: 'osm', reports: 'local', ai: 'server', map: 'osm' })
  const osmRef = useRef<OsmData | null>(null)

  const [motion, setMotion] = useState<MotionStats | null>(null)
  const sensor = useRef<MotionSensor | null>(null)
  const simulated = useRef(true)

  const pois = useMemo(() => mergePois(osmPois), [osmPois])

  // ---- 資料載入 ----
  useEffect(() => {
    ;(async () => {
      const [net, sw, shared] = await Promise.all([loadDemoNetwork(), loadSidewalks(), fetchSharedReports()])
      osmRef.current = net
      setOsmPois(net.pois)
      setSidewalks(sw)
      const all = mergeReports(loadLocalReports(), shared.reports)
      setReports(all)
      setStatus((s) => ({ ...s, network: 'demo', sidewalk: !!sw, reports: shared.shared ? 'shared' : 'local' }))
      // 背景升級成即時路網（成功才替換）
      loadLiveNetwork(TAOYUAN_STATION).then((live) => {
        if (!live) return
        osmRef.current = live
        setOsmPois(live.pois)
        setStatus((s) => ({ ...s, network: 'live' }))
      })
      // 探測 Places 是否可用
      fetch('/api/places?q=cafe&lat=24.989&lng=121.314', { signal: AbortSignal.timeout(6000) })
        .then((r) => setStatus((s) => ({ ...s, places: r.ok ? 'google' : 'osm' })))
        .catch(() => setStatus((s) => ({ ...s, places: 'osm' })))
    })()
  }, [])

  // 路網圖：回報變動時重建（回報會真的改變權重）
  useEffect(() => {
    if (!osmRef.current) return
    setGraph(buildGraph(osmRef.current, sidewalks, reports, pois))
  }, [sidewalks, reports, pois, osmPois])

  // ---- 定位 ----
  const relocate = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude }
        setUserPos(here)
        if (haversine(here, TAOYUAN_STATION) < 2500) {
          setOrigin(here)
          setOriginLabel('目前位置')
          simulated.current = false
        } else {
          setOriginLabel('你在示範區外，起點暫用桃園車站')
        }
      },
      () => setOriginLabel('無法定位，起點暫用桃園車站'),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [])
  useEffect(() => {
    relocate()
  }, [relocate])

  // ---- 規劃 ----
  const plan = useCallback(() => {
    if (!graph || !destination) return
    setPlanning(true)
    setStep('routes')
    setTimeout(() => {
      const now = new Date()
      const rs = planRoutes({ graph, origin, destination: destination.pos, profile, pois, ctx: { now, sun: sunPosition(now, origin.lat, origin.lng) } })
      setRoutes(rs)
      setSelected(rs[0]?.id ?? null)
      setPlanning(false)
      const all = rs.flatMap((r) => r.coords)
      if (all.length) setFit({ coords: all, key: `routes-${Date.now()}` })
    }, 30)
  }, [graph, destination, origin, profile, pois])

  // ---- 導航（模擬或真實） ----
  useEffect(() => {
    if (step !== 'navigate' || !trip) return
    const s = new MotionSensor()
    sensor.current = s
    s.start().then(() => setMotion(s.stats()))
    const off = s.onChange(setMotion)

    let watchId: number | null = null
    let timer: number | null = null
    const coords = trip.route.coords
    const total = lineLength(coords)
    if (!simulated.current && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (p) => {
          const here = { lat: p.coords.latitude, lng: p.coords.longitude }
          setUserPos(here)
          // 以離終點距離推估進度
          const remain = haversine(here, trip.destination)
          setProgress(Math.max(0, Math.min(1, 1 - remain / total)))
        },
        undefined,
        { enableHighAccuracy: true },
      )
    } else {
      // 模擬：每 200ms 前進 6 公尺
      let walked = 0
      timer = window.setInterval(() => {
        walked += 6
        const t = Math.min(1, walked / total)
        setProgress(t)
        // 沿線內插
        let acc = 0
        for (let i = 1; i < coords.length; i++) {
          const seg = haversine({ lng: coords[i - 1][0], lat: coords[i - 1][1] }, { lng: coords[i][0], lat: coords[i][1] })
          if (acc + seg >= walked || i === coords.length - 1) {
            const f = seg ? Math.min(1, (walked - acc) / seg) : 1
            setUserPos({ lng: coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * f, lat: coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * f })
            break
          }
          acc += seg
        }
        if (t >= 1 && timer) window.clearInterval(timer)
      }, 200)
    }
    return () => {
      off()
      s.stop()
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
      if (timer) window.clearInterval(timer)
    }
  }, [step, trip])

  const startTrip = () => {
    const r = routes.find((x) => x.id === selected)
    if (!r || !destination) return
    setProgress(0)
    setTrip({ origin, destination: destination.pos, destinationName: destination.name, route: r, profile, startedAt: Date.now(), highlights: highlightsAlong(r.coords, pois) })
    setStep('navigate')
    setFit({ coords: r.coords, key: `nav-${Date.now()}` })
  }

  const finishTrip = () => {
    if (!trip) return
    setTrip({ ...trip, endedAt: Date.now() })
    setStep('summary')
  }

  const goHome = () => {
    setStep('input')
    setDestination(null)
    setRoutes([])
    setSelected(null)
    setTrip(null)
    setProfile(DEFAULT_PROFILE)
    setProgress(0)
    setFit({ coords: [[origin.lng, origin.lat]], key: `home-${Date.now()}` })
  }

  const addReport = async (at: LatLng, type: ReportType, note: string, stars?: number) => {
    const r: Report = { id: newId(), lat: at.lat, lng: at.lng, type, note: note || undefined, stars, ts: Date.now(), sensor: motion && motion.samples > 20 ? { rms: Number(motion.rms.toFixed(3)), samples: motion.samples } : undefined }
    setReports((rs) => mergeReports(rs, [r]))
    return submitReport(r)
  }

  // ---- 地圖圖層 ----
  const routeLayers: RouteLayer[] = useMemo(() => {
    if (step === 'navigate' || step === 'summary') return trip ? [{ id: trip.route.id, coords: trip.route.coords, color: trip.route.color, selected: true }] : []
    if (step === 'routes') return routes.map((r) => ({ id: r.id, coords: r.coords, color: r.color, selected: r.id === selected }))
    return []
  }, [step, routes, selected, trip])

  const markers: MarkerSpec[] = useMemo(() => {
    const m: MarkerSpec[] = [{ id: 'origin', pos: origin, kind: 'origin', label: '起點' }]
    if (destination) m.push({ id: 'dest', pos: destination.pos, kind: 'dest', label: destination.name })
    if (userPos && (step === 'navigate' || !simulated.current)) m.push({ id: 'user', pos: userPos, kind: 'user' })
    const r = step === 'routes' ? routes.find((x) => x.id === selected) : trip?.route
    r?.via.forEach((p) => m.push({ id: `via-${p.id}`, pos: p, kind: 'via', label: p.name }))
    if (step === 'summary' && trip) trip.highlights.forEach((p, i) => m.push({ id: `hl-${p.id}`, pos: p, kind: 'poi', label: p.name, emoji: String(i + 1) }))
    for (const rp of reports) if (rp.type !== 'good') m.push({ id: `rep-${rp.id}`, pos: rp, kind: 'report', label: rp.type })
    return m
  }, [origin, destination, userPos, step, routes, selected, trip, reports])

  const onMapClick = (p: LatLng) => {
    if (step === 'input') {
      setDestination({ pos: p, name: `地圖上的點 (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})` })
    } else if (step === 'navigate') {
      setReportAt(p)
    }
  }

  const surprisePick = (theme: SurpriseTheme) => pickSurprise(theme, [origin.lng, origin.lat], pois)
  const surpriseGo = (poi: Poi) => {
    setSurpriseOpen(false)
    setDestination({ pos: { lat: poi.lat, lng: poi.lng }, name: poi.name })
    setProfile({ needs: ['explore', 'stroll', 'sidewalk'], detours: [], text: '驚喜轉盤', notes: ['城市探索：繞經文化亮點、悠閒散步'], source: 'preset' })
    setStep('needs')
  }

  const selectedRoute = routes.find((r) => r.id === selected)

  return (
    <div className="relative h-full w-full overflow-hidden bg-sand-50">
      <MapView
        center={origin}
        routes={routeLayers}
        markers={markers}
        sidewalks={sidewalks as unknown as GeoJSON.FeatureCollection | null}
        showSidewalks={showSidewalks}
        viewMode={viewMode}
        fitTo={fit.coords}
        fitKey={fit.key}
        onClick={onMapClick}
        onReady={(kind) => setStatus((s) => ({ ...s, map: kind }))}
      />

      <TopBar viewMode={viewMode} onViewMode={setViewMode} showSidewalks={showSidewalks} onToggleSidewalks={() => setShowSidewalks((v) => !v)} status={status} />

      <div className="absolute left-0 right-0 bottom-0 safe-b px-3 z-20 max-w-md mx-auto">
        {step === 'input' && (
          <SearchPanel
            origin={origin}
            originLabel={originLabel}
            pois={pois}
            destination={destination}
            onPickDestination={(d) => {
              setDestination(d)
              if (d) setFit({ coords: [[origin.lng, origin.lat], [d.pos.lng, d.pos.lat]], key: `dest-${Date.now()}` })
            }}
            onNext={() => setStep('needs')}
            onSurprise={() => setSurpriseOpen(true)}
            onRelocate={relocate}
            placesAvailable={status.places === 'google'}
          />
        )}
        {step === 'needs' && (
          <NeedsSheet profile={profile} onChange={setProfile} onBack={() => setStep('input')} onPlan={plan} aiAvailable={status.ai === 'server'} onAiStatus={(ok) => setStatus((s) => ({ ...s, ai: ok ? 'server' : 'keyword' }))} />
        )}
        {step === 'routes' && (
          <RouteOptions
            routes={routes}
            selected={selected}
            onSelect={(id) => {
              setSelected(id)
              const r = routes.find((x) => x.id === id)
              if (r) setFit({ coords: r.coords, key: `sel-${id}-${Date.now()}` })
            }}
            onBack={() => setStep('needs')}
            onStart={startTrip}
            loading={planning || !graph}
            demo={!!graph?.demo}
          />
        )}
        {step === 'navigate' && trip && (
          <NavigationView route={trip.route} destinationName={trip.destinationName} progress={progress} motion={motion} simulated={simulated.current} onReport={() => setReportAt(userPos ?? origin)} onFinish={finishTrip} />
        )}
        {step === 'summary' && trip && (
          <TripSummary
            trip={trip}
            motion={motion}
            onToggleLike={() => setTrip({ ...trip, liked: !trip.liked })}
            onToggleSave={() => {
              const t = { ...trip, saved: !trip.saved }
              setTrip(t)
              try {
                const saved = JSON.parse(localStorage.getItem('pp.trips') ?? '[]') as unknown[]
                localStorage.setItem('pp.trips', JSON.stringify([...saved, { name: t.destinationName, at: t.startedAt, route: t.route.id, match: t.route.match }].slice(-50)))
              } catch {
                /* ignore */
              }
            }}
            onRate={(stars, note) => addReport(trip.destination, 'good', note, stars)}
            onReportIssue={() => setReportAt(userPos ?? trip.destination)}
            onHome={goHome}
            onFocusPoi={(p) => setFit({ coords: [[p.lng, p.lat]], key: `poi-${p.id}-${Date.now()}` })}
          />
        )}
      </div>

      {step === 'routes' && selectedRoute && (
        <div className="absolute top-40 right-3 z-10 card px-2.5 py-1.5 text-xs pointer-events-none" style={{ color: selectedRoute.color }}>
          ● {selectedRoute.label} {selectedRoute.match}%
        </div>
      )}

      {surpriseOpen && <SurpriseWheel onPick={surprisePick} onGo={surpriseGo} onClose={() => setSurpriseOpen(false)} />}
      {reportAt && <ReportModal at={reportAt} onSubmit={(t, n) => addReport(reportAt, t, n)} onClose={() => setReportAt(null)} />}
    </div>
  )
}
