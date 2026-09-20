/** 健康檢查：只回傳綁定名稱（不含值），供確認 secret / KV 是否綁進 Functions */
export const onRequestGet: PagesFunction<Record<string, unknown>> = async ({ env }) => {
  const bindings = Object.keys(env).sort()
  return new Response(JSON.stringify({ ok: true, bindings, hasAnthropic: typeof env.ANTHROPIC_API_KEY === 'string' && env.ANTHROPIC_API_KEY.length > 0, hasPlaces: !!env.GOOGLE_PLACES_KEY, hasKV: !!env.REPORTS }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}
