import type { DetourKind, LngLat, Poi } from '../types'
import { distLngLat, pointToLineM } from './geo'

/** 繞徑類別 → POI kind 對照 */
const DETOUR_KINDS: Record<DetourKind, string[]> = {
  drink: ['bubble_tea', 'beverages', 'tea', 'juice_bar', 'drink'],
  coffee: ['cafe', 'coffee_shop', 'coffee'],
  book: ['books', 'library', 'stationery', 'book_store'],
  bakery: ['bakery', 'pastry'],
  convenience: ['convenience', 'convenience_store', 'supermarket'],
  temple: ['place_of_worship', 'temple', 'church', 'hindu_temple', 'buddhist_temple'],
  park: ['park', 'garden'],
  toilet: ['toilets', 'public_bathroom'],
  dessert: ['ice_cream', 'dessert', 'ice_cream_shop', 'dessert_shop', 'bakery'],
  food: ['restaurant', 'fast_food', 'food_court', 'meal_takeaway', 'marketplace'],
}

/** 飲料店在 OSM 常標成 cafe / fast_food，用名稱補判 */
const DRINK_NAME = /茶|飲|奶|coco|清心|50嵐|五十嵐|迷客夏|可不可|麻古|大苑子|龜記|鶴茶樓|珍煮丹|一沐日|得正|再睡5分鐘|茶湯會|tea/i
const DESSERT_NAME = /冰|甜點|蛋糕|豆花|仙草|dessert|cake|ice/i

export function poisForDetour(pois: Poi[], kind: DetourKind): Poi[] {
  const kinds = DETOUR_KINDS[kind]
  return pois.filter((p) => {
    if (kinds.includes(p.kind)) return true
    if (kind === 'drink' && (p.kind === 'cafe' || p.kind === 'fast_food' || p.kind === 'restaurant') && DRINK_NAME.test(p.name)) return true
    if (kind === 'dessert' && DESSERT_NAME.test(p.name)) return true
    return false
  })
}

/** 文化亮點優先序（越前越優先） */
const HIGHLIGHT_PRIORITY: Record<string, number> = {
  museum: 10,
  attraction: 10,
  house: 9,
  ruins: 9,
  monument: 9,
  memorial: 8,
  artwork: 8,
  gallery: 8,
  arts_centre: 8,
  stele: 7,
  place_of_worship: 7,
  library: 6,
  books: 6,
  park: 5,
  community_centre: 4,
  tea: 4,
  gift: 3,
  marketplace: 6,
  viewpoint: 8,
  information: 1,
}

/** 桃園車站周邊策展亮點（示範用補充描述；座標以 OSM 為主，名稱吻合時套用描述） */
export const CURATED_DESC: Record<string, string> = {
  桃園77藝文町: '日治時期警察局宿舍群改造的文創園區，木造老屋、市集與展覽，車站步行約 8 分鐘。',
  桃園鐵道願景館: '舊桃園車站倉庫再利用，展示桃園鐵路地下化與軌道文化。',
  桃園文學館: '藏身於老屋內的文學空間，常有在地作家講座與展覽。',
  桃園市土地公文化館: '全台唯一以土地公信仰為主題的文化館，呈現桃園「土地公密度最高」的城市故事。',
  桃園關帝廟: '桃園舊城區信仰中心之一，周邊巷弄保留老街屋與傳統市場氛圍。',
  桃園劍道故事館: '日式木造武德殿建築，展示桃園劍道文化，建築本身即是亮點。',
  桃園農工日式舊校舍: '保存良好的日式校舍建築群，散步途中的靜謐一隅。',
  舊桃園高中車站: '桃林鐵路舊站遺跡，如今是林蔭步道的一部分。',
  桃林鐵路步道: '由廢棄鐵道改建的線形綠廊，平整無車、適合推車與散步。',
  南門公園: '舊城區鄰里公園，午後樹蔭充足。',
  文昌公園: '中正路旁的口袋公園，鄰近文昌廟與老街商圈。',
  朝陽森林公園: '車站北側最大的綠地，內有朝陽水語教育園區。',
  臺灣土地改革陳列館: '記錄台灣農地改革歷史的專題館，鄰近桃園市立圖書館。',
  桃園觀光夜市: '桃園在地最熱鬧的夜市之一，傍晚後活力十足。',
  虎頭山公園: '桃園市民的後花園，登高可俯瞰整座城市。',
}

/** 額外策展點（OSM 缺漏者） */
export const CURATED_POIS: Poi[] = [
  {
    id: 'c-jingfu',
    name: '桃園景福宮',
    lat: 24.9962,
    lng: 121.3119,
    kind: 'place_of_worship',
    cat: 'amenity',
    source: 'curated',
    desc: '創建於 1745 年的桃園「大廟」，舊城區的信仰與生活中心，廟前廣場是在地人的日常舞台。',
  },
  {
    id: 'c-newmarket',
    name: '桃園新民街老街區',
    lat: 24.9945,
    lng: 121.3105,
    kind: 'attraction',
    cat: 'tourism',
    source: 'curated',
    desc: '大廟周邊的老街巷弄，保留傳統市場、老字號小吃與騎樓街屋。',
  },
]

export function mergePois(osm: Poi[]): Poi[] {
  const names = new Set(osm.map((p) => p.name))
  const out: Poi[] = osm.map((p) => ({ ...p, source: p.source ?? 'osm', desc: p.desc ?? CURATED_DESC[p.name] }))
  for (const c of CURATED_POIS) if (!names.has(c.name)) out.push(c)
  return out
}

/** 沿線 5 大亮點：距路線 ≤ maxDist，依優先序與描述有無排序 */
export function highlightsAlong(route: LngLat[], pois: Poi[], maxDist = 90, limit = 5): Poi[] {
  const scored: { p: Poi; s: number; d: number }[] = []
  for (const p of pois) {
    const pri = HIGHLIGHT_PRIORITY[p.kind]
    if (!pri) continue
    const d = pointToLineM([p.lng, p.lat], route)
    if (d > maxDist) continue
    scored.push({ p, s: pri + (p.desc ? 3 : 0) - d / 60, d })
  }
  scored.sort((a, b) => b.s - a.s)
  const out: Poi[] = []
  const seen = new Set<string>()
  for (const { p } of scored) {
    if (seen.has(p.name)) continue
    seen.add(p.name)
    out.push(p)
    if (out.length >= limit) break
  }
  // 不足時以距離補
  if (out.length < limit) {
    const rest = pois
      .filter((p) => HIGHLIGHT_PRIORITY[p.kind] && !seen.has(p.name))
      .map((p) => ({ p, d: pointToLineM([p.lng, p.lat], route) }))
      .sort((a, b) => a.d - b.d)
    for (const { p, d } of rest) {
      if (d > 300 || out.length >= limit) break
      seen.add(p.name)
      out.push(p)
    }
  }
  return out
}

/** 驚喜轉盤主題 */
export interface SurpriseTheme {
  id: string
  label: string
  emoji: string
  kinds: string[]
  color: string
}
export const SURPRISE_THEMES: SurpriseTheme[] = [
  { id: 'temple', label: '廟埕巷弄', emoji: '🏮', kinds: ['place_of_worship'], color: '#dc2626' },
  { id: 'art', label: '藝文散步', emoji: '🎨', kinds: ['museum', 'gallery', 'artwork', 'arts_centre', 'house'], color: '#7c3aed' },
  { id: 'green', label: '綠意公園', emoji: '🌳', kinds: ['park'], color: '#16a34a' },
  { id: 'book', label: '書香一角', emoji: '📚', kinds: ['books', 'library'], color: '#0369a1' },
  { id: 'heritage', label: '老屋時光', emoji: '🏚️', kinds: ['ruins', 'attraction', 'house', 'stele', 'monument'], color: '#b45309' },
  { id: 'market', label: '市場美食', emoji: '🍜', kinds: ['marketplace', 'attraction', 'restaurant', 'fast_food'], color: '#ea580c' },
]

/** 依主題挑一個 400–1400m 內的目的地 */
export function pickSurprise(theme: SurpriseTheme, from: LngLat, pois: Poi[], exclude: Set<string> = new Set()): Poi | null {
  const cands = pois
    .filter((p) => theme.kinds.includes(p.kind) && !exclude.has(p.id))
    .map((p) => ({ p, d: distLngLat(from, [p.lng, p.lat]) }))
    .filter(({ d }) => d >= 350 && d <= 1400)
  if (!cands.length) return null
  // 有描述者加權
  const weighted = cands.flatMap(({ p }) => (p.desc ? [p, p, p] : [p]))
  return weighted[Math.floor(Math.random() * weighted.length)]
}
