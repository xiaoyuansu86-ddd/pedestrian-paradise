import { useState } from 'react'
import { X } from 'lucide-react'
import type { LatLng, ReportType } from '../types'
import { REPORT_TYPES } from '../lib/reports'

interface Props {
  at: LatLng
  onSubmit: (type: ReportType, note: string) => Promise<boolean>
  onClose: () => void
}

export function ReportModal({ at, onSubmit, onClose }: Props) {
  const [type, setType] = useState<ReportType | null>(null)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'local'>('idle')

  return (
    <div className="fixed inset-0 z-50 bg-sand-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="card w-full max-w-md p-5 m-3 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center">
          <div className="flex-1">
            <h2 className="font-semibold text-lg">回報這裡的路況</h2>
            <p className="text-xs text-sand-700">
              位置 {at.lat.toFixed(5)}, {at.lng.toFixed(5)}（目前所在／地圖點選）
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-sand-700" aria-label="關閉">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {REPORT_TYPES.map((r) => (
            <button
              key={r.type}
              onClick={() => setType(r.type)}
              className={`text-left rounded-xl border-2 p-2.5 ${type === r.type ? 'border-paradise-700 bg-paradise-50' : 'border-sand-200 bg-white'}`}
            >
              <div className="text-lg">{r.emoji}</div>
              <div className="text-sm font-medium">{r.label}</div>
              <div className="text-[11px] text-sand-700">{r.desc}</div>
            </button>
          ))}
        </div>

        <input className="w-full rounded-xl bg-sand-100 px-3 py-2.5 text-sm outline-none" placeholder="補充說明（選填）" value={note} onChange={(e) => setNote(e.target.value)} />

        {state === 'done' || state === 'local' ? (
          <div className="text-sm text-center py-2">
            {state === 'done' ? '✅ 已送出並同步到共享資料庫，重新規劃時會實際繞開。' : '✅ 已存在本機（雲端暫時無法連線），重新規劃時仍會繞開。'}
            <button className="btn-primary mt-3" onClick={onClose}>
              完成
            </button>
          </div>
        ) : (
          <button
            className="btn-primary"
            disabled={!type || state === 'sending'}
            onClick={async () => {
              if (!type) return
              setState('sending')
              const ok = await onSubmit(type, note)
              setState(ok ? 'done' : 'local')
            }}
          >
            {state === 'sending' ? '送出中…' : '送出回報'}
          </button>
        )}
      </div>
    </div>
  )
}
