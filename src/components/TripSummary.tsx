import { useState } from 'react'
import { Bookmark, Heart, Star, Home } from 'lucide-react'
import type { Poi, Trip } from '../types'
import type { MotionStats } from '../lib/motion'
import { fmtDistance, fmtMinutes } from '../lib/geo'

interface Props {
  trip: Trip
  motion: MotionStats | null
  onToggleLike: () => void
  onToggleSave: () => void
  onRate: (stars: number, note: string) => Promise<boolean>
  onReportIssue: () => void
  onHome: () => void
  onFocusPoi: (p: Poi) => void
}

const KIND_EMOJI: Record<string, string> = {
  museum: '🏛️', attraction: '📸', artwork: '🎨', gallery: '🖼️', place_of_worship: '🏮', park: '🌳', library: '📚', books: '📖', ruins: '🏚️', house: '🏠', stele: '🪨',
  community_centre: '🏘️', tea: '🍵', gift: '🎁', marketplace: '🧺', information: 'ℹ️', arts_centre: '🎭', monument: '🗿', memorial: '🕯️',
}

export function TripSummary({ trip, motion, onToggleLike, onToggleSave, onRate, onReportIssue, onHome, onFocusPoi }: Props) {
  const [stars, setStars] = useState(trip.rating ?? 0)
  const [note, setNote] = useState('')
  const [sent, setSent] = useState<null | boolean>(null)
  const suggested = motion && motion.samples > 20 ? (motion.roughness === 0 ? 5 : motion.roughness === 1 ? 3 : 2) : null

  return (
    <div className="card p-4 flex flex-col gap-3 max-h-[78vh] overflow-y-auto">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-xs text-sand-700">旅程完成 🎉</div>
          <h2 className="font-semibold text-lg leading-tight">{trip.destinationName}</h2>
          <div className="text-sm text-sand-700 mt-0.5">
            {fmtDistance(trip.route.distance)} · 約 {fmtMinutes(trip.route.minutes)} · {trip.route.label} {trip.route.match}% 符合
          </div>
        </div>
        <button onClick={onToggleLike} className={`p-2 rounded-full ${trip.liked ? 'bg-rose-100 text-rose-600' : 'bg-sand-100 text-sand-700'}`} aria-label="愛心">
          <Heart size={20} fill={trip.liked ? 'currentColor' : 'none'} />
        </button>
        <button onClick={onToggleSave} className={`p-2 rounded-full ${trip.saved ? 'bg-paradise-100 text-paradise-700' : 'bg-sand-100 text-sand-700'}`} aria-label="儲存">
          <Bookmark size={20} fill={trip.saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <section>
        <h3 className="text-sm font-semibold mb-1.5">途經亮點</h3>
        {trip.highlights.length === 0 && <div className="text-sm text-sand-700">這條路線附近沒有已建檔的文化站點。</div>}
        <ol className="flex flex-col gap-1.5">
          {trip.highlights.map((p, i) => (
            <li key={p.id}>
              <button className="w-full text-left flex gap-2.5 items-start rounded-xl bg-sand-50 p-2.5 active:bg-sand-100" onClick={() => onFocusPoi(p)}>
                <span className="w-7 h-7 rounded-full bg-white border border-sand-200 flex items-center justify-center text-sm shrink-0">{KIND_EMOJI[p.kind] ?? '📍'}</span>
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    <span className="text-sand-700 mr-1">{i + 1}.</span>
                    {p.name}
                  </div>
                  {p.desc && <div className="text-xs text-sand-700 mt-0.5 leading-relaxed">{p.desc}</div>}
                </div>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-sand-200 p-3">
        <h3 className="text-sm font-semibold">這段路好走嗎？</h3>
        <p className="text-xs text-sand-700 mb-2">你的回饋會成為第一手步行數據，下一位行人的路線會因此更好。</p>
        <div className="flex gap-1 mb-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} onClick={() => setStars(s)} aria-label={`${s} 星`} className="p-1">
              <Star size={28} className={s <= stars ? 'text-amber-500' : 'text-sand-200'} fill={s <= stars ? 'currentColor' : 'none'} />
            </button>
          ))}
          {suggested && stars === 0 && (
            <button className="ml-auto text-xs text-paradise-700 underline" onClick={() => setStars(suggested)}>
              感測器建議 {suggested} 星
            </button>
          )}
        </div>
        {motion && motion.samples > 20 && (
          <div className="text-xs text-sand-700 mb-2">
            加速度計：RMS {motion.rms.toFixed(2)} m/s²、{motion.spikes} 次顛簸 → 路面{['平整', '普通', '顛簸'][motion.roughness]}（尚待真機校正）
          </div>
        )}
        <input className="w-full rounded-xl bg-sand-100 px-3 py-2 text-sm outline-none mb-2" placeholder="補充：例如「中正路騎樓被機車擋住」" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-2">
          <button
            className="btn-primary !py-2.5 flex-1"
            disabled={stars === 0 || sent === true}
            onClick={async () => {
              const ok = await onRate(stars, note)
              setSent(ok)
            }}
          >
            {sent === true ? '已送出，謝謝！' : '送出評分'}
          </button>
          <button className="btn-ghost" onClick={onReportIssue}>
            舉報問題點
          </button>
        </div>
        {sent === false && <div className="text-xs text-amber-700 mt-1">已存在本機；雲端同步稍後重試。</div>}
      </section>

      <button className="flex items-center justify-center gap-2 text-sand-700 py-2" onClick={onHome}>
        <Home size={16} /> 回到首頁
      </button>
    </div>
  )
}
