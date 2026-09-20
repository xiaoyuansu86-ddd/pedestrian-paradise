import { useState } from 'react'
import { ArrowLeft, Bot, Send } from 'lucide-react'
import type { DetourKind, NeedKey, NeedProfile } from '../types'
import { DETOUR_LABEL, NEED_LABEL, PRESETS, mergeProfiles, parseNeedsKeyword } from '../lib/needs'

interface Props {
  profile: NeedProfile
  onChange: (p: NeedProfile) => void
  onBack: () => void
  onPlan: () => void
  aiAvailable: boolean
  onAiStatus: (ok: boolean) => void
}

const EXAMPLES = ['剛做完眼睛雷射不能逆光', '想邊散步邊買飲料', '推嬰兒車，不要階梯', '晚上一個人走，要有路燈', '拉行李箱去飯店，路要平']

async function parseWithAi(text: string): Promise<NeedProfile | null> {
  try {
    const res = await fetch('/api/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }), signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const d = (await res.json()) as { needs: NeedKey[]; detours: DetourKind[]; notes: string[] }
    return { needs: d.needs, detours: d.detours, text, notes: d.notes, source: 'ai' }
  } catch {
    return null
  }
}

export function NeedsSheet({ profile, onChange, onBack, onPlan, aiAvailable, onAiStatus }: Props) {
  const [text, setText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [log, setLog] = useState<{ who: 'user' | 'ai'; text: string }[]>([])

  const activePresets = new Set(PRESETS.filter((p) => p.needs.every((n) => profile.needs.includes(n))).map((p) => p.id))

  const togglePreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id)!
    if (activePresets.has(id)) {
      const others = PRESETS.filter((x) => x.id !== id && activePresets.has(x.id)).flatMap((x) => x.needs)
      onChange({ ...profile, needs: profile.needs.filter((n) => !p.needs.includes(n) || others.includes(n)), source: 'preset' })
    } else {
      onChange({ ...profile, needs: [...new Set([...profile.needs, ...p.needs])], notes: [...new Set([...profile.notes, p.hint])], source: profile.source === 'ai' ? 'ai' : 'preset' })
    }
  }

  const submit = async (t: string) => {
    const q = t.trim()
    if (!q) return
    setText('')
    setLog((l) => [...l, { who: 'user', text: q }])
    setThinking(true)
    let parsed: NeedProfile | null = null
    if (aiAvailable) {
      parsed = await parseWithAi(q)
      onAiStatus(!!parsed)
    }
    if (!parsed) parsed = parseNeedsKeyword(q)
    setThinking(false)
    const merged = mergeProfiles(profile, parsed)
    onChange(merged)
    const summary = [
      parsed.needs.filter((n) => n !== 'sidewalk' || parsed!.needs.length === 1).map((n) => NEED_LABEL[n]).join('、'),
      parsed.detours.length ? `順路繞經 ${parsed.detours.map((d) => DETOUR_LABEL[d]).join('、')}` : '',
    ]
      .filter(Boolean)
      .join('；')
    setLog((l) => [...l, { who: 'ai', text: `了解！我會幫你${summary ? '：' + summary : '找安全好走的路'}。${parsed!.source === 'ai' ? '' : '（關鍵字判讀）'}` }])
  }

  const removeNeed = (n: NeedKey) => onChange({ ...profile, needs: profile.needs.filter((x) => x !== n) })
  const removeDetour = (d: DetourKind) => onChange({ ...profile, detours: profile.detours.filter((x) => x !== d) })

  return (
    <div className="card p-4 flex flex-col gap-3 max-h-[70vh]">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1 -ml-1 text-sand-700" aria-label="返回">
          <ArrowLeft size={20} />
        </button>
        <h2 className="font-semibold text-lg">這趟路，你需要什麼？</h2>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit(text)
        }}
      >
        <input
          className="flex-1 rounded-xl bg-sand-100 px-3 py-2.5 text-base outline-none focus:ring-2 ring-paradise-500"
          placeholder="例如：剛做完眼睛雷射不能逆光"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="rounded-xl bg-paradise-700 text-white px-3 disabled:opacity-40" disabled={!text.trim() || thinking} aria-label="送出">
          <Send size={18} />
        </button>
      </form>

      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
        {PRESETS.map((p) => (
          <button key={p.id} className={`chip ${activePresets.has(p.id) ? 'chip-on' : 'chip-off'}`} onClick={() => togglePreset(p.id)} title={p.hint}>
            <span>{p.emoji}</span>
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2">
        {log.length === 0 && (
          <div className="text-sm text-sand-700 flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Bot size={18} className="shrink-0 mt-0.5 text-paradise-700" />
              <span>也可以用一句話告訴我更細的狀況，例如：</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {EXAMPLES.map((e) => (
                <button key={e} className="chip chip-off !text-xs" onClick={() => submit(e)}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}
        {log.map((m, i) => (
          <div key={i} className={`text-sm max-w-[88%] rounded-2xl px-3 py-2 ${m.who === 'user' ? 'self-end bg-paradise-700 text-white' : 'self-start bg-sand-100'}`}>
            {m.text}
          </div>
        ))}
        {thinking && <div className="self-start text-sm text-sand-700 px-3 py-2">思考中…</div>}
      </div>

      {(profile.needs.length > 0 || profile.detours.length > 0) && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          {profile.needs.map((n) => (
            <button key={n} className="chip chip-on !text-xs !py-1" onClick={() => removeNeed(n)} title="點擊移除">
              {NEED_LABEL[n]} ×
            </button>
          ))}
          {profile.detours.map((d) => (
            <button key={d} className="chip !text-xs !py-1 bg-amber-500 text-white border-amber-500" onClick={() => removeDetour(d)} title="點擊移除">
              繞經{DETOUR_LABEL[d]} ×
            </button>
          ))}
        </div>
      )}

      <button className="btn-mint" onClick={onPlan}>
        幫我規劃路線
      </button>
    </div>
  )
}
