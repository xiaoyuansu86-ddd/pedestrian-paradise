# 行人天堂 Pedestrian Paradise

專為行人與跨載具使用者打造的「人本交通客製化步行導航與城市體驗 APP」— 桃園車站周邊 1.5 km 示範區。

- 線上版：https://pedestrian-paradise.pages.dev
- 技術：Vite + React + TypeScript + Tailwind v4，Cloudflare Pages（Functions + KV）

## 功能對照

| 需求 | 實作位置 |
|---|---|
| 起終點輸入、開頁定位 | `src/components/SearchPanel.tsx`（OSM POI 本地搜尋；有 Places 金鑰時加上 Google 結果；可點地圖選點） |
| 快捷選單 + AI 對話判讀 | `src/components/NeedsSheet.tsx`、`src/lib/needs.ts`（中英關鍵字，免金鑰）、`functions/api/parse.ts`（Anthropic 語意解析，失敗自動降級） |
| 三條分級路線與符合度 % | `src/lib/router.ts` 自建加權 Dijkstra，不使用 Google Directions；權重依《桃園人行道評估彙整》AHP（淨寬／鋪面／無障礙／照明／遮蔽） |
| 人行道圖資疊圖 | `public/data/sidewalk_taoyuan_station_1500m.geojson`（國土署 SIDEWALK_202606 WGS84，781 筆）→ `src/lib/network.ts` 掛到路段：淨寬、寬度、路緣斜坡 |
| 即時 OSM 路網 | `functions/api/overpass.ts` 代發 Overpass、邊緣快取 1h；App 先載示範路網再背景升級 |
| 2D／等角／3D、客製配色 | `src/map/MapLibreAdapter.ts`（無金鑰預設）、`src/map/GoogleMapAdapter.ts`（有 `VITE_GOOGLE_MAPS_KEY` 時） |
| 驚喜轉盤、沿線 5 大亮點 | `src/components/SurpriseWheel.tsx`、`src/lib/pois.ts` |
| 愛心／儲存／星等回饋、路況舉報 | `src/components/TripSummary.tsx`、`ReportModal.tsx`、`functions/api/reports.ts`（KV 共享；離線存本機）。回報會改變路網權重，重新規劃時實際繞開 |
| 加速度計路面平整度 | `src/lib/motion.ts`（已實作，門檻待真機校正） |

## 本機開發

```bash
npm install
npm run dev        # 只跑前端（/api 會 proxy 到 8788）
npm run dev:cf     # 另開終端：Cloudflare Functions 本機模擬
```

伺服器端金鑰放 `.dev.vars`（已 gitignore）：

```
GOOGLE_PLACES_KEY=...
ANTHROPIC_API_KEY=...
```

前端 Google 底圖金鑰放 `.env`：`VITE_GOOGLE_MAPS_KEY=...`（請在 Google Cloud 限制 HTTP referrer 為 `*.pages.dev`）。都不填也能跑，會用 OSM 底圖與關鍵字判讀。

## 部署

```bash
npm run deploy     # build + wrangler pages deploy
# 伺服器端 secret（只需一次）
wrangler pages secret put ANTHROPIC_API_KEY --project-name pedestrian-paradise
wrangler pages secret put GOOGLE_PLACES_KEY --project-name pedestrian-paradise
```

## 資料來源

- 內政部國土管理署《人行道》開放資料 SIDEWALK_202606（data.gov.tw/dataset/58791）
- OpenStreetMap contributors（ODbL），經 Overpass API
- OpenFreeMap 向量圖磚（底圖）
- Google Maps Platform：Maps JavaScript API、Places API (New)（選配）

資料缺口：騎樓高低落差、路面平整度全台無開放資料，由使用者感測與回報補足。
