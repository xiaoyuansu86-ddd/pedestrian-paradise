import { AlertTriangle, Flag, Activity } from 'lucide-react'
import type { RouteOption } from '../types'
import type { MotionStats } from '../lib/motion'
import { fmtDistance, fmtMinutes } from '../lib/geo'

interface Props {
  route: RouteOption
  destinationName: string
  progress: number // 0..1
  motion: MotionStats | null
  simulated: boolean
  onReport: () => void
  onFinish: () => void
}

export function NavigationView({ route, destinationName, progress, motion, simulated, onReport, onFinish }: Props) {
  const remaining = route.distance * (1 - progress)
  const remainMin = route.minutes * (1 - progress)
  const roughLabel = motion ? ['平整', '普通', '顛簸'][motion.roughness] : null
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

      <div className="flex items-center justify-between text-xs text-sand-700">
        <span className="flex items-center gap-1">
          <Activity size={14} />
          路面感測：{motion?.supported ? (motion.permission === 'granted' ? `${roughLabel}（RMS ${motion.rms.toFixed(2)}，${motion.samples} 筆）` : '未授權') : '此裝置不支援'}
        </span>
        {simulated && <span className="bg-amber-100 text-amber-800 rounded px-1.5 py-0.5">模擬行走</span>}
      </div>

      <div className="flex gap-2">
        <button className="flex-1 rounded-2xl bg-amber-500 text-white font-semibold py-3 flex items-center justify-center gap-2 active:bg-amber-600" onClick={onReport}>
          <AlertTriangle size={18} /> 回報路況
        </button>
        <button className="flex-1 rounded-2xl bg-paradise-700 text-white font-semibold py-3 flex items-center justify-center gap-2 active:bg-paradise-800" onClick={onFinish}>
          <Flag size={18} /> {progress >= 0.98 ? '抵達，結束旅程' : '結束旅程'}
        </button>
      </div>
    </div>
  )
}
