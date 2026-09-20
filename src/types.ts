export type LatLng = { lat: number; lng: number }
/** [lng, lat] — GeoJSON 順序 */
export type LngLat = [number, number]

export type ViewMode = '2d' | 'iso' | '3d'

/** 個人化需求鍵值（由快捷選單或 AI 對話判讀而來） */
export type NeedKey =
  | 'sidewalk' // 基本：有人行道 / 避開車流
  | 'noSteps' // 避開階梯
  | 'smooth' // 路面平整、避坑洞
  | 'wheelchair' // 輪椅無障礙
  | 'stroller' // 嬰兒推車
  | 'luggage' // 行李箱
  | 'shade' // 陰影 / 不曬太陽
  | 'noGlare' // 避逆光（眼科術後）
  | 'lit' // 夜間照明
  | 'quiet' // 安靜、車少
  | 'kids' // 親子
  | 'stroll' // 悠閒散步
  | 'explore' // 城市探索、文化亮點
  | 'fast' // 趕時間

/** 途中想繞去的店家類型 */
export type DetourKind =
  | 'drink'
  | 'coffee'
  | 'book'
  | 'bakery'
  | 'convenience'
  | 'temple'
  | 'park'
  | 'toilet'
  | 'dessert'
  | 'food'

export interface NeedProfile {
  needs: NeedKey[]
  detours: DetourKind[]
  /** 使用者原始輸入 */
  text: string
  /** 判讀說明（顯示給使用者） */
  notes: string[]
  source: 'preset' | 'keyword' | 'ai'
}

export interface OsmWay {
  id: number
  n: number[]
  t: Record<string, string>
}

export interface Poi {
  id: string
  name: string
  en?: string | null
  lat: number
  lng: number
  kind: string
  cat: string
  source?: 'osm' | 'google' | 'curated'
  desc?: string
  address?: string
}

export interface OsmData {
  meta: { source: string; osm_base?: string; center: LngLat; radius_m: number; license?: string; demo?: boolean }
  nodes: Record<string, LngLat>
  ways: OsmWay[]
  pois: Poi[]
}

export type ReportType = 'pothole' | 'arcade_blocked' | 'no_ramp' | 'dark' | 'narrow' | 'good'

export interface Report {
  id: string
  lat: number
  lng: number
  type: ReportType
  note?: string
  stars?: number
  ts: number
  sensor?: { rms: number; samples: number }
}

export interface EdgeAttrs {
  highway: string
  name?: string
  /** 0 無車 / 1 低 / 2 中 / 3 高 */
  traffic: 0 | 1 | 2 | 3
  sidewalk: 'yes' | 'no' | 'unknown'
  /** 國土署圖資：人行道寬度、淨寬、路緣斜坡數 */
  swWidth?: number
  netWidth?: number
  ramps?: number
  steps: boolean
  elevator: boolean
  /** 0 佳 / 1 普通 / 2 差 */
  surface: 0 | 1 | 2
  lit: boolean | null
  covered: boolean
  /** 0..1 建物/騎樓遮蔭推估 */
  shade: number
  pedestrianOnly: boolean
  /** 鄰近文化亮點數 */
  culture: number
  park: boolean
  reports: ReportType[]
}

export interface Edge {
  id: number
  from: number
  to: number
  len: number
  /** 由 from → to 的方位角（度，0=北，順時針） */
  bearing: number
  attrs: EdgeAttrs
  /** [lng,lat] 由 from → to */
  coords: LngLat[]
}

export interface Graph {
  nodes: Map<number, LngLat>
  /** node id → 由此出發的邊（雙向皆建） */
  adj: Map<number, Edge[]>
  edges: Edge[]
  bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }
  nearestNode(p: LatLng): number | null
  sidewalkCount: number
  demo: boolean
}

export interface RouteOption {
  id: 'A' | 'B' | 'C'
  label: string
  tagline: string
  color: string
  coords: LngLat[]
  distance: number
  minutes: number
  /** 0..100 */
  match: number
  needScores: Partial<Record<NeedKey, number>>
  explanations: string[]
  via: Poi[]
  edges: Edge[]
  stats: RouteStats
}

export interface RouteStats {
  sidewalkPct: number
  stepsCount: number
  litPct: number
  shadeIdx: number
  highTrafficPct: number
  poorSurfaceM: number
  wideNetPct: number
}

export interface Trip {
  origin: LatLng
  destination: LatLng
  destinationName: string
  route: RouteOption
  profile: NeedProfile
  startedAt: number
  endedAt?: number
  highlights: Poi[]
  liked?: boolean
  saved?: boolean
  rating?: number
}
