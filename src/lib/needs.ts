import type { DetourKind, NeedKey, NeedProfile } from '../types'

export interface Preset {
  id: string
  label: string
  emoji: string
  needs: NeedKey[]
  detours?: DetourKind[]
  hint: string
}

/** 快捷選單（Sheet 上方 chips） */
export const PRESETS: Preset[] = [
  { id: 'safe', label: '安全好走', emoji: '🚶', needs: ['sidewalk', 'smooth', 'noSteps'], hint: '有人行道、路面平整、避開階梯' },
  { id: 'access', label: '無障礙', emoji: '♿', needs: ['wheelchair', 'noSteps', 'smooth'], hint: '輪椅可行、有路緣斜坡、淨寬 ≥1.5m' },
  { id: 'family', label: '親子', emoji: '👶', needs: ['kids', 'stroller', 'sidewalk'], hint: '推車友善、車少、經公園' },
  { id: 'stroll', label: '散步', emoji: '🌿', needs: ['stroll', 'shade', 'quiet'], hint: '悠閒、有遮蔭、安靜' },
  { id: 'glare', label: '避強光', emoji: '🕶️', needs: ['noGlare', 'shade'], hint: '依太陽方位避開逆光路段' },
  { id: 'night', label: '夜間照明', emoji: '🌙', needs: ['lit', 'sidewalk'], hint: '優先有路燈的路' },
  { id: 'luggage', label: '拉行李', emoji: '🧳', needs: ['luggage', 'noSteps', 'smooth'], hint: '避階梯、避坑洞' },
  { id: 'explore', label: '城市探索', emoji: '✨', needs: ['explore', 'stroll'], hint: '繞經巷弄老店與文化點' },
]

export const NEED_LABEL: Record<NeedKey, string> = {
  sidewalk: '有人行道',
  noSteps: '避開階梯',
  smooth: '路面平整',
  wheelchair: '輪椅無障礙',
  stroller: '推車友善',
  luggage: '行李友善',
  shade: '有遮蔭',
  noGlare: '避逆光',
  lit: '夜間照明',
  quiet: '安靜車少',
  kids: '親子安全',
  stroll: '悠閒散步',
  explore: '城市探索',
  fast: '趕時間',
}

export const DETOUR_LABEL: Record<DetourKind, string> = {
  drink: '飲料店',
  coffee: '咖啡店',
  book: '書店',
  bakery: '麵包店',
  convenience: '便利商店',
  temple: '廟宇',
  park: '公園',
  toilet: '廁所',
  dessert: '甜點冰品',
  food: '小吃美食',
}

type Rule = { keys: NeedKey[]; kw: string[]; note: string }
const NEED_RULES: Rule[] = [
  { keys: ['wheelchair', 'noSteps', 'smooth'], kw: ['輪椅', '無障礙', '電動車', 'wheelchair', 'accessib'], note: '輪椅無障礙：優先淨寬 ≥1.5m、有路緣斜坡、避階梯' },
  { keys: ['stroller', 'noSteps'], kw: ['推車', '嬰兒車', '娃娃車', '寶寶', 'stroller', 'pram', 'buggy'], note: '推車友善：避階梯、避窄路' },
  { keys: ['luggage', 'noSteps', 'smooth'], kw: ['行李', '拉箱', '行李箱', 'luggage', 'suitcase'], note: '行李友善：避階梯與碎石路面' },
  { keys: ['noSteps'], kw: ['階梯', '樓梯', '爬', '膝蓋', '腳痛', '腳受傷', '拐杖', 'stairs', 'steps', 'knee', 'crutch'], note: '避開階梯' },
  { keys: ['smooth'], kw: ['坑洞', '平整', '平坦', '不平', '顛簸', '高低差', 'pothole', 'smooth', 'bumpy', 'flat'], note: '優先平整路面、避開回報坑洞' },
  { keys: ['shade'], kw: ['陰影', '遮蔭', '遮陰', '不曬', '曬', '太陽', '涼', '熱', '騎樓', '樹蔭', 'shade', 'shady', 'sun', 'hot', 'cool'], note: '優先有遮蔭（騎樓/樹蔭/窄巷）' },
  { keys: ['noGlare'], kw: ['逆光', '眼睛', '雷射', '手術', '刺眼', '眩光', '怕光', '畏光', 'glare', 'laser', 'eye', 'photophob'], note: '依目前太陽方位避開逆光路段' },
  { keys: ['lit'], kw: ['晚上', '夜', '路燈', '照明', '很暗', '天黑', 'dark', 'night', 'lit', 'lamp'], note: '優先有路燈的路段' },
  { keys: ['quiet'], kw: ['安靜', '車少', '少車', '不要大馬路', '避開車', '吵', 'quiet', 'traffic', 'calm'], note: '避開車流大的道路' },
  { keys: ['kids', 'sidewalk'], kw: ['小孩', '孩子', '親子', '兒童', '小朋友', 'kid', 'child', 'family', 'toddler'], note: '親子安全：優先有人行道、車少、經公園' },
  { keys: ['stroll'], kw: ['散步', '慢慢', '悠閒', '走走', '逛', 'stroll', 'leisure', 'wander', 'relax'], note: '悠閒路線，不求最短' },
  { keys: ['explore'], kw: ['探索', '驚喜', '老街', '巷弄', '文化', '景點', '古蹟', '老店', '在地', 'explore', 'surprise', 'culture', 'heritage', 'local'], note: '城市探索：繞經文化亮點' },
  { keys: ['fast'], kw: ['快', '趕', '最短', '急', 'fast', 'quick', 'hurry', 'shortest', 'asap'], note: '趕時間：以最短距離為主' },
  { keys: ['sidewalk'], kw: ['人行道', '安全', 'sidewalk', 'safe'], note: '優先有人行道' },
]

type DRule = { key: DetourKind; kw: string[] }
const DETOUR_RULES: DRule[] = [
  { key: 'drink', kw: ['飲料', '手搖', '珍奶', '奶茶', '買杯', 'bubble', 'boba', 'drink', 'tea shop'] },
  { key: 'coffee', kw: ['咖啡', 'coffee', 'cafe', 'café', 'latte'] },
  { key: 'book', kw: ['書店', '買書', '看書', 'book'] },
  { key: 'bakery', kw: ['麵包', '烘焙', 'bakery', 'bread'] },
  { key: 'convenience', kw: ['超商', '便利商店', '7-11', '711', '全家', '萊爾富', 'convenience'] },
  { key: 'temple', kw: ['廟', '拜拜', '宮', 'temple', 'shrine'] },
  { key: 'park', kw: ['公園', '綠地', 'park', 'green'] },
  { key: 'toilet', kw: ['廁所', '洗手間', 'toilet', 'restroom', 'bathroom'] },
  { key: 'dessert', kw: ['甜點', '冰', '蛋糕', 'dessert', 'ice cream', 'cake'] },
  { key: 'food', kw: ['吃', '小吃', '美食', '午餐', '晚餐', '早餐', 'food', 'eat', 'lunch', 'dinner', 'snack'] },
]

const NEG = ['不要', '不用', '不想', '別', '沒有', '避免', 'no ', 'not ', "don't", 'avoid']

function negatedBefore(text: string, idx: number): boolean {
  const pre = text.slice(Math.max(0, idx - 4), idx)
  return NEG.some((n) => pre.includes(n))
}

/** 純前端關鍵字判讀（中英雙語、免金鑰、斷網可用） */
export function parseNeedsKeyword(text: string): NeedProfile {
  const t = text.toLowerCase()
  const needs = new Set<NeedKey>()
  const detours = new Set<DetourKind>()
  const notes: string[] = []

  for (const r of NEED_RULES) {
    const hit = r.kw.find((k) => t.includes(k))
    if (hit) {
      // 「不要大馬路」等否定其實是同義，不視為否定；只有 fast/explore 受否定影響
      const idx = t.indexOf(hit)
      if ((r.keys.includes('fast') || r.keys.includes('explore')) && negatedBefore(t, idx)) continue
      r.keys.forEach((k) => needs.add(k))
      notes.push(r.note)
    }
  }
  for (const r of DETOUR_RULES) {
    const hit = r.kw.find((k) => t.includes(k))
    if (hit) {
      const idx = t.indexOf(hit)
      if (negatedBefore(t, idx)) continue
      // 「吃」太寬，若已命中其他更具體類別就不加 food
      if (r.key === 'food' && detours.size > 0) continue
      detours.add(r.key)
    }
  }
  if (detours.size) notes.push(`途中順路繞經：${[...detours].map((d) => DETOUR_LABEL[d]).join('、')}`)

  // 趕時間與散步互斥
  if (needs.has('fast') && needs.has('stroll')) needs.delete('stroll')
  if (needs.size === 0 && detours.size === 0 && text.trim()) notes.push('沒有辨識到特別需求，先以「安全好走」規劃')
  if (needs.size === 0) needs.add('sidewalk')

  return { needs: [...needs], detours: [...detours], text, notes, source: 'keyword' }
}

export function mergeProfiles(a: NeedProfile, b: NeedProfile): NeedProfile {
  const needs = new Set<NeedKey>([...a.needs, ...b.needs])
  if (needs.size > 1 && needs.has('sidewalk') && (needs.has('wheelchair') || needs.has('kids'))) {
    // sidewalk 已隱含
  }
  return {
    needs: [...needs],
    detours: [...new Set([...a.detours, ...b.detours])],
    text: [a.text, b.text].filter(Boolean).join('；'),
    notes: [...new Set([...a.notes, ...b.notes])],
    source: b.source === 'ai' || a.source === 'ai' ? 'ai' : b.source,
  }
}

export const ALL_NEED_KEYS = Object.keys(NEED_LABEL) as NeedKey[]
export const ALL_DETOUR_KEYS = Object.keys(DETOUR_LABEL) as DetourKind[]
