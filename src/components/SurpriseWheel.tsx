import { useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { Poi } from '../types'
import { SURPRISE_THEMES, type SurpriseTheme } from '../lib/pois'

interface Props {
  onPick: (theme: SurpriseTheme) => Poi | null
  onGo: (poi: Poi, theme: SurpriseTheme) => void
  onClose: () => void
}

export function SurpriseWheel({ onPick, onGo, onClose }: Props) {
  const [rot, setRot] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<{ theme: SurpriseTheme; poi: Poi | null } | null>(null)
  const n = SURPRISE_THEMES.length
  const seg = 360 / n

  const spin = () => {
    if (spinning) return
    setResult(null)
    setSpinning(true)
    const idx = Math.floor(Math.random() * n)
    // 指針在頂端（0°）；讓第 idx 片的中心停在頂端
    const target = 360 * 5 + (360 - (idx * seg + seg / 2))
    const next = rot - (rot % 360) + target
    setRot(next)
    setTimeout(() => {
      const theme = SURPRISE_THEMES[idx]
      setResult({ theme, poi: onPick(theme) })
      setSpinning(false)
    }, 3300)
  }

  const gradient = `conic-gradient(${SURPRISE_THEMES.map((t, i) => `${t.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')})`

  return (
    <div className="fixed inset-0 z-50 bg-sand-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="card w-full max-w-md p-5 m-3 flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex w-full items-center">
          <div className="flex-1">
            <h2 className="font-semibold text-lg">✨ 驚喜轉盤</h2>
            <p className="text-xs text-sand-700">不知道去哪？讓城市替你決定一段 10–20 分鐘的小旅行。</p>
          </div>
          <button onClick={onClose} className="p-1 text-sand-700" aria-label="關閉">
            <X size={20} />
          </button>
        </div>

        <div className="relative w-64 h-64">
          <div className="absolute left-1/2 -top-2 -translate-x-1/2 z-10 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[22px] border-l-transparent border-r-transparent border-t-sand-900" />
          <motion.div
            className="w-64 h-64 rounded-full border-[6px] border-white shadow-xl relative"
            style={{ background: gradient }}
            animate={{ rotate: rot }}
            transition={{ duration: 3.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {SURPRISE_THEMES.map((t, i) => {
              const a = (i * seg + seg / 2 - 90) * (Math.PI / 180)
              const x = 50 + 34 * Math.cos(a)
              const y = 50 + 34 * Math.sin(a)
              return (
                <div key={t.id} className="absolute text-white text-center text-xs font-semibold drop-shadow" style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}>
                  <div className="text-xl">{t.emoji}</div>
                  {t.label}
                </div>
              )
            })}
          </motion.div>
          <div className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-white shadow flex items-center justify-center text-2xl">🎡</div>
        </div>

        {result ? (
          <div className="w-full rounded-2xl p-3 text-white" style={{ background: result.theme.color }}>
            <div className="text-xs opacity-90">
              {result.theme.emoji} {result.theme.label}
            </div>
            {result.poi ? (
              <>
                <div className="font-semibold text-lg">{result.poi.name}</div>
                {result.poi.desc && <div className="text-xs opacity-90 mt-0.5 leading-relaxed">{result.poi.desc}</div>}
                <div className="flex gap-2 mt-3">
                  <button className="flex-1 rounded-xl bg-white/95 text-sand-900 font-semibold py-2.5" onClick={() => onGo(result.poi!, result.theme)}>
                    就去這裡！
                  </button>
                  <button className="rounded-xl bg-white/20 px-4 font-semibold" onClick={spin}>
                    再轉一次
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="font-semibold">附近暫時沒有這類地點</div>
                <button className="mt-2 rounded-xl bg-white/95 text-sand-900 font-semibold py-2 px-4" onClick={spin}>
                  再轉一次
                </button>
              </>
            )}
          </div>
        ) : (
          <button className="btn-primary bg-delight-500 active:bg-delight-600" onClick={spin} disabled={spinning}>
            {spinning ? '轉動中…' : '轉一下'}
          </button>
        )}
      </div>
    </div>
  )
}
