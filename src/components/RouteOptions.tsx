import { ArrowLeft, Footprints, Navigation } from 'lucide-react'
import type { RouteOption } from '../types'
import { fmtDistance, fmtMinutes } from '../lib/geo'

interface Props {
  routes: RouteOption[]
  selected: RouteOption['id'] | null
  onSelect: (id: RouteOption['id']) => void
  onBack: () => void
  onStart: () => void
  loading: boolean
  demo: boolean
}

function MatchBadge({ v, color }: { v: number; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center w-16 shrink-0">
      <div className="relative w-12 h-12">
        <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e2dccd" strokeWidth="3.5" />
          <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3.5" strokeDasharray={`${(v / 100) * 97.4} 97.4`} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-bold" style={{ color }}>
          {v}%
        </div>
      </div>
      <div className="text-[10px] text-sand-700 mt-0.5">符合需求</div>
    </div>
  )
}

export function RouteOptions({ routes, selected, onSelect, onBack, onStart, loading, demo }: Props) {
  return (
    <div className="card p-4 flex flex-col gap-3 max-h-[70vh]">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 -ml-1 text-sand-700" aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-semibold text-lg flex-1">為你找到 {routes.length} 條路線</h2>
        {demo && <span className="text-[10px] bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">示範路網</span>}
      </div>

      {loading && <div className="text-sm text-sand-700 py-6 text-center">正在用加權路網計算中…</div>}
      {!loading && routes.length === 0 && <div className="text-sm text-sand-700 py-6 text-center">找不到可步行路線。目的地可能在示範區（桃園車站 1.5 km）之外，請換一個地點試試。</div>}

      <div className="flex flex-col gap-2 overflow-y-auto min-h-0">
        {routes.map((r) => {
          const on = r.id === selected
          return (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`text-left rounded-2xl border-2 p-3 flex gap-3 transition-colors ${on ? 'border-current bg-white' : 'border-sand-200 bg-sand-50'}`}
              style={{ color: on ? r.color : undefined }}
            >
              <MatchBadge v={r.match} color={r.color} />
              <div className="flex-1 min-w-0 text-sand-900">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold" style={{ color: r.color }}>
                    {r.label}
                  </span>
                  <span className="text-xs text-sand-700">{r.tagline}</span>
                </div>
                <div className="flex items-center gap-3 text-sm mt-0.5">
                  <span className="flex items-center gap-1">
                    <Footprints size={14} /> {fmtDistance(r.distance)}
                  </span>
                  <span>約 {fmtMinutes(r.minutes)}</span>
                </div>
                <ul className="mt-1.5 text-xs text-sand-700 flex flex-col gap-0.5">
                  {r.explanations.slice(0, on ? 5 : 2).map((e, i) => (
                    <li key={i} className="flex gap-1">
                      <span style={{ color: r.color }}>•</span>
                      <span>{e}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </button>
          )
        })}
      </div>

      <button className="btn-primary flex items-center justify-center gap-2" disabled={!selected || loading} onClick={onStart}>
        <Navigation size={18} /> 開始步行
      </button>
    </div>
  )
}
