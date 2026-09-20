/**
 * 自然語言需求判讀（進階）：伺服器端呼叫 Anthropic API，金鑰存於 secret ANTHROPIC_API_KEY。
 * POST /api/parse { text }
 * 沒金鑰或失敗 → 503 { fallback: true }，前端自動降級為關鍵字比對。
 */
import Anthropic from '@anthropic-ai/sdk'

interface Env {
  ANTHROPIC_API_KEY?: string
}

const NEEDS = ['sidewalk', 'noSteps', 'smooth', 'wheelchair', 'stroller', 'luggage', 'shade', 'noGlare', 'lit', 'quiet', 'kids', 'stroll', 'explore', 'fast'] as const
const DETOURS = ['drink', 'coffee', 'book', 'bakery', 'convenience', 'temple', 'park', 'toilet', 'dessert', 'food'] as const

const SYSTEM = `你是「行人天堂」步行導航 App 的需求判讀器。把使用者用中文或英文描述的步行情境，轉成結構化需求。
需求鍵值說明：
- sidewalk 有人行道/避開車流；noSteps 避開階梯；smooth 路面平整避坑洞；wheelchair 輪椅無障礙；stroller 嬰兒推車；luggage 拉行李箱
- shade 不曬太陽/要遮蔭；noGlare 避逆光（眼科術後、畏光）；lit 夜間要有照明；quiet 安靜車少；kids 帶小孩親子安全
- stroll 悠閒散步不求最短；explore 想探索巷弄文化亮點；fast 趕時間要最短
繞徑類別 detours：drink 飲料/手搖；coffee 咖啡；book 書店；bakery 麵包；convenience 超商；temple 廟；park 公園；toilet 廁所；dessert 甜點冰品；food 小吃
規則：只挑真正提到或明確隱含的；「剛做完眼睛雷射」→ noGlare + shade；「腳受傷」→ noSteps + smooth；notes 用繁體中文一句話說明你理解到什麼（最多 3 條）。`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['needs', 'detours', 'notes'],
  properties: {
    needs: { type: 'array', items: { type: 'string', enum: [...NEEDS] } },
    detours: { type: 'array', items: { type: 'string', enum: [...DETOURS] } },
    notes: { type: 'array', items: { type: 'string' } },
  },
} as const

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })
  if (!env.ANTHROPIC_API_KEY) return json({ fallback: true, reason: 'no key' }, 503)
  let text = ''
  try {
    text = String(((await request.json()) as { text?: string }).text ?? '').slice(0, 500)
  } catch {
    return json({ error: 'bad json' }, 400)
  }
  if (!text.trim()) return json({ error: 'empty' }, 400)

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 })
  try {
    const res = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1024,
      system: SYSTEM,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      messages: [{ role: 'user', content: text }],
    })
    if (res.stop_reason === 'refusal') return json({ fallback: true, reason: 'refusal' }, 503)
    const block = res.content.find((b) => b.type === 'text')
    if (!block || block.type !== 'text') return json({ fallback: true, reason: 'no text' }, 503)
    const parsed = JSON.parse(block.text) as { needs: string[]; detours: string[]; notes: string[] }
    const needs = parsed.needs.filter((n) => (NEEDS as readonly string[]).includes(n))
    const detours = parsed.detours.filter((d) => (DETOURS as readonly string[]).includes(d))
    return json({ needs: needs.length ? needs : ['sidewalk'], detours, notes: parsed.notes ?? [], source: 'ai' })
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined
    return json({ fallback: true, reason: `anthropic ${status ?? ''} ${(e as Error).message}`.trim() }, 503)
  }
}
