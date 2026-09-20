/**
 * Google Places API (New) 代發 — 金鑰只存在 Cloudflare secret（GOOGLE_PLACES_KEY），不進瀏覽器。
 * GET /api/places?q=飲料&lat=..&lng=..[&r=800]
 * 沒有金鑰 → 503 { fallback: true }，前端改用 OSM POI。
 */
interface Env {
  GOOGLE_PLACES_KEY?: string
}

const TYPE_MAP: Record<string, string> = {
  drink: 'bubble tea 飲料店',
  coffee: 'cafe',
  book: 'book store 書店',
  bakery: 'bakery',
  convenience: 'convenience store',
  temple: 'temple 廟',
  park: 'park',
  toilet: 'public toilet',
  dessert: 'dessert 甜點',
  food: 'restaurant',
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.GOOGLE_PLACES_KEY) return new Response(JSON.stringify({ fallback: true, reason: 'no key' }), { status: 503, headers: { 'content-type': 'application/json' } })
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const lat = Number(url.searchParams.get('lat'))
  const lng = Number(url.searchParams.get('lng'))
  const r = Math.min(3000, Number(url.searchParams.get('r') ?? 1200))
  if (!q || !Number.isFinite(lat) || !Number.isFinite(lng)) return new Response('bad params', { status: 400 })

  const cacheKey = new Request(`https://cache.pedestrian-paradise/places?q=${encodeURIComponent(q)}&lat=${lat.toFixed(3)}&lng=${lng.toFixed(3)}`)
  const hit = await caches.default.match(cacheKey)
  if (hit) return hit

  const body = {
    textQuery: TYPE_MAP[q] ?? q,
    languageCode: 'zh-TW',
    regionCode: 'TW',
    maxResultCount: 12,
    locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: r } },
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': env.GOOGLE_PLACES_KEY,
      'x-goog-fieldmask': 'places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) return new Response(JSON.stringify({ fallback: true, reason: `google ${res.status}` }), { status: 503, headers: { 'content-type': 'application/json' } })
  type GPlace = { id: string; displayName?: { text: string }; formattedAddress?: string; location?: { latitude: number; longitude: number }; primaryType?: string; types?: string[] }
  const data = (await res.json()) as { places?: GPlace[] }
  const places = (data.places ?? [])
    .filter((p) => p.location)
    .map((p) => ({
      id: `g-${p.id}`,
      name: p.displayName?.text ?? '',
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      kind: p.primaryType ?? p.types?.[0] ?? 'place',
      cat: 'google',
      source: 'google',
      address: p.formattedAddress,
    }))
  const out = new Response(JSON.stringify({ places }), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=1800' } })
  await caches.default.put(cacheKey, out.clone())
  return out
}
