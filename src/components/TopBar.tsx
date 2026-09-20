import { Layers, Box, Square, Pyramid } from 'lucide-react'
import type { ViewMode } from '../types'
import type { DataStatus } from '../lib/data'

interface Props {
  viewMode: ViewMode
  onViewMode: (m: ViewMode) => void
  showSidewalks: boolean
  onToggleSidewalks: () => void
  status: DataStatus
}

const MODES: { id: ViewMode; label: string; Icon: typeof Square }[] = [
  { id: '2d', label: '2D', Icon: Square },
  { id: 'iso', label: '等角', Icon: Pyramid },
  { id: '3d', label: '3D', Icon: Box },
]

export function TopBar({ viewMode, onViewMode, showSidewalks, onToggleSidewalks, status }: Props) {
  return (
    <div className="absolute top-0 left-0 right-0 safe-t px-3 pointer-events-none z-20">
      <div className="flex items-start gap-2">
        <div className="card px-3 py-2 pointer-events-auto flex items-center gap-2">
          <img src="/favicon.svg" alt="" className="w-7 h-7 rounded-lg" />
          <div className="leading-tight">
            <div className="font-bold text-sm">行人天堂</div>
            <div className="text-[10px] text-sand-700">Pedestrian Paradise · 桃園車站示範區</div>
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex flex-col gap-2 items-end pointer-events-auto">
          <div className="card p-1 flex">
            {MODES.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => onViewMode(id)}
                className={`flex items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium ${viewMode === id ? 'bg-paradise-700 text-white' : 'text-sand-700'}`}
                aria-label={label}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <button onClick={onToggleSidewalks} className={`card px-2.5 py-1.5 flex items-center gap-1 text-xs font-medium ${showSidewalks ? 'text-paradise-700' : 'text-sand-700'}`}>
            <Layers size={14} /> 人行道圖資
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 pointer-events-auto">
        <Badge ok={status.network === 'live'} label={status.network === 'live' ? 'OSM 即時路網' : status.network === 'loading' ? '路網載入中' : 'OSM 示範路網（示意）'} />
        <Badge ok={status.sidewalk} label={status.sidewalk ? '國土署人行道 202606' : '無人行道圖資'} />
        <Badge ok={status.map === 'google'} label={status.map === 'google' ? 'Google 底圖' : 'OSM 底圖'} neutral />
        <Badge ok={status.reports === 'shared'} label={status.reports === 'shared' ? '共享回報' : '本機回報'} neutral />
        <Badge ok={status.ai === 'server'} label={status.ai === 'server' ? 'AI 語意解析' : '關鍵字判讀'} neutral />
      </div>
    </div>
  )
}

function Badge({ ok, label, neutral }: { ok: boolean; label: string; neutral?: boolean }) {
  const cls = ok ? 'bg-paradise-100 text-paradise-800' : neutral ? 'bg-sand-100 text-sand-700' : 'bg-amber-100 text-amber-800'
  return <span className={`text-[10px] rounded-full px-2 py-0.5 ${cls} shadow-sm`}>{label}</span>
}
