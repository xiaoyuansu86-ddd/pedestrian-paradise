import { useEffect, useMemo, useState } from 'react'
import { LocateFixed, MapPin, Search, Sparkles, X } from 'lucide-react'
import type { LatLng, Poi } from '../types'
import { searchLocal, searchPlaces } from '../lib/data'
import { fmtDistance, haversine } from '../lib/geo'

interface Props {
  origin: LatLng
  originLabel: string
  pois: Poi[]
  destination: { pos: LatLng; name: string } | null
  onPickDestination: (d: { pos: LatLng; name: string } | null) => void
  onNext: () => void
  onSurprise: () => void
  onRelocate: () => void
  placesAvailable: boolean
}

const SUGGEST = ['桃園77藝文町', '桃園景福宮', '桃園鐵道願景館', '桃園市土地公文化館', '朝陽森林公園', '桃園文學館']

export function SearchPanel({ origin, originLabel, pois, destination, onPickDestination, onNext, onSurprise, onRelocate, placesAvailable }: Props) {
  const [q, setQ] = useState('')
  const [remote, setRemote] = useState<Poi[] | null>(null)
  const [busy, setBusy] = useState(false)

  const local = useMemo(() => searchLocal(q, pois, origin), [q, pois, origin])

  useEffect(() => {
    if (!placesAvailable || q.trim().length < 2) {
      setRemote(null)
      return
    }
    const t = setTimeout(async () => {
      setBusy(true)
      const r = await searchPlaces(q, origin)
      setRemote(r)
      setBusy(false)
    }, 450)
    return () => clearTimeout(t)
  }, [q, origin, placesAvailable])

  const results = useMemo(() => {
    const seen = new Set<string>()
    const out: Poi[] = []
    for (const p of [...local, ...(remote ?? [])]) {
      const k = p.name + Math.round(p.lat * 1e4)
      if (seen.has(k)) continue
      seen.add(k)
      out.push(p)
    }
    return out.slice(0, 8)
  }, [local, remote])

  const suggestions = useMemo(() => SUGGEST.map((n) => pois.find((p) => p.name === n)).filter((p): p is Poi => !!p), [pois])

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2 text-sm text-sand-700">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-paradise-700" />
        <span className="flex-1 truncate">{originLabel}</span>
        <button className="btn-ghost !py-1 !px-2 flex items-center gap-1" onClick={onRelocate} aria-label="重新定位">
          <LocateFixed size={14} /> 定位
        </button>
      </div>

      {destination ? (
        <div className="flex items-center gap-2 bg-sand-100 rounded-xl px-3 py-2.5">
          <MapPin size={18} className="text-delight-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{destination.name}</div>
            <div className="text-xs text-sand-700">直線 {fmtDistance(haversine(origin, destination.pos))}</div>
          </div>
          <button onClick={() => onPickDestination(null)} aria-label="清除" className="p-1 text-sand-700">
            <X size={18} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search size={18} className="absolute left-3 top-3 text-sand-700" />
          <input
            className="w-full rounded-xl bg-sand-100 pl-10 pr-3 py-2.5 text-base outline-none focus:ring-2 ring-paradise-500"
            placeholder="要去哪裡？輸入地點或點地圖"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoComplete="off"
          />
          {busy && <span className="absolute right-3 top-3 text-xs text-sand-700">搜尋中…</span>}
        </div>
      )}

      {!destination && q.trim() && (
        <ul className="max-h-56 overflow-y-auto -mx-1 divide-y divide-sand-100">
          {results.length === 0 && <li className="px-2 py-3 text-sm text-sand-700">找不到「{q}」，可以直接點地圖選目的地</li>}
          {results.map((p) => (
            <li key={p.id}>
              <button
                className="w-full text-left px-2 py-2.5 flex items-center gap-3 active:bg-sand-100 rounded-lg"
                onClick={() => {
                  onPickDestination({ pos: { lat: p.lat, lng: p.lng }, name: p.name })
                  setQ('')
                }}
              >
                <MapPin size={16} className="text-sand-700 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-sand-700 truncate">
                    {p.address ?? p.kind} · {fmtDistance(haversine(origin, p))}
                    {p.source === 'google' && ' · Google'}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!destination && !q.trim() && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {suggestions.map((p) => (
            <button key={p.id} className="chip chip-off" onClick={() => onPickDestination({ pos: { lat: p.lat, lng: p.lng }, name: p.name })}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <button className="btn-primary flex-1" disabled={!destination} onClick={onNext}>
          下一步：告訴我你的需求
        </button>
        <button className="rounded-2xl px-4 bg-delight-500 text-white font-semibold active:bg-delight-600 flex items-center gap-1" onClick={onSurprise} aria-label="驚喜轉盤">
          <Sparkles size={18} />
        </button>
      </div>
    </div>
  )
}
