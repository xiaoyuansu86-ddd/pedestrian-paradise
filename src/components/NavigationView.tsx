import { useEffect, useRef, useState } from 'react'
import { Flag, Activity } from 'lucide-react'
import type { Poi, ReportType, RouteOption } from '../types'
import type { MotionStats } from '../lib/motion'
import { fmtDistance, fmtMinutes } from '../lib/geo'
import { DETOUR_EMOJI, type RouteSpot } from '../lib/pois'
import { DETOUR_LABEL } from '../lib/needs'
import { REPORT_TYPES } from '../lib/reports'

interface Props {
  route: RouteOption
  destinationName: string
  progress: number // 0..1
  motion: MotionStats | null
  simulated: boolean
  /** 沿線符合需求的地點（已標在地圖上） */
  spots: RouteSpot[]
  onFocusSpot: (p: Poi) => void
  /** 一鍵回報目前所在位置的路況；回傳是否已同步到雲端 */
  onQuickReport: (type: ReportType) => Promise<boolean>
  onFinish: () => void
}

export function NavigationView({ route, destinationName, progress, motion, simulated, spots, onFocusSpot, onQuickReport, onFinish }: Props) {
  const remaining = route.distance * (1 - progress)
  const remainMin = route.minutes * (1 - progress)
  const roughLabel = motion ? ['平整', '普通', '顛簸'][motion.roughness] : null

  const [sending, setSending] = useState<ReportType | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<number | null>(null)
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
  }, [])

  const quickReport = async (type: ReportType) => {
    if (sending) return
    const meta = REPORT_TYPES.find((r) => r.type === type)!
    setSending(type)
    const ok = await onQuickReport(type)
    setSending(null)
    setToast(`${meta.emoji} 已回報「${meta.label}」${ok ? '，已同步共享' : '（暫存本機）'}`)
    if (toastTimer.current) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2500)
  }
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-xl" style={{ background: route.color }}>
          🚶
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-sand-700">前往</div>
          <div className="font-semibold truncate">{destinationName}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold leading-tight">{fmtMinutes(remainMin)}</div>
          <div className="text-xs text-sand-700">剩 {fmtDistance(remaining)}</div>
        </div>
      </div>

      <div className="h-2 rounded-full bg-sand-100 overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(progress * 100)}%`, background: route.color }} />
      </div>

      {spots.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-xs text-sand-700">沿路符合你需求的地點（點擊定位）</div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
            {spots.map((s) => (
              <button key={s.poi.id} className="chip chip-off !py-1 shrink-0 flex-col !items-start !gap-0 !rounded-xl" onClick={() => onFocusSpot(s.poi)}>
                <span className="text-sm">
                  {DETOUR_EMOJI[s.kind]} {s.poi.name}
                </span>
                <span className="text-[10px] text-sand-700 font-normal">{s.d === 0 ? `${DETOUR_LABEL[s.kind]} · 順路繞經` : `${DETOUR_LABEL[s.kind]} · 離路線 ${Math.round(s.d)} m`}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-sand-700">
        <span className="flex items-center gap-1">
          <Activity size={14} />
          路面感測：{motion?.supported ? (motion.permission === 'granted' ? `${roughLabel}（RMS ${motion.rms.toFixed(2)}，${motion.samples} 筆）` : '未授權') : '此裝置不支援'}
        </span>
        {simulated && <span className="bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">模擬行走</span>}
      </div>

      {/* 即時路況回報：一鍵送出目前位置，不開視窗、不遮地圖 */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-sand-700">
          <span>這裡的路況（點一下立即回報）</span>
          {toast && <span className="text-paradise-700 font-medium truncate ml-2">{toast}</span>}
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.type}
              className={`chip shrink-0 !py-1.5 ${r.type === 'good' ? 'bg-paradise-50 border-paradise-500 text-paradise-800' : 'bg-amber-50 border-amber-400 text-amber-900'} ${sending === r.type ? 'opacity-50' : 'active:scale-95'}`}
              disabled={!!sending}
              onClick={() => quickReport(r.type)}
              title={r.desc}
            >
              <span>{r.emoji}</span>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <button className="rounded-2xl bg-paradise-700 text-white font-semibold py-3 flex items-center justify-center gap-2 active:bg-paradise-800" onClick={onFinish}>
        <Flag size={18} /> {progress >= 0.98 ? '抵達，結束旅程' : '結束旅程'}
      </button>
    </div>
  )
}
