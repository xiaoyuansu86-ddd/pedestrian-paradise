// 太陽方位角 / 高度角（NOAA 簡化演算法），用於「避逆光」與「遮蔭」加權
const D2R = Math.PI / 180
const R2D = 180 / Math.PI

export interface SunPosition {
  /** 方位角，度，0=北、90=東 */
  azimuth: number
  /** 高度角，度；<0 表示日落後 */
  altitude: number
}

export function sunPosition(date: Date, lat: number, lng: number): SunPosition {
  const jd = date.getTime() / 86400000 + 2440587.5
  const n = jd - 2451545.0
  const L = (280.46 + 0.9856474 * n) % 360
  const g = ((357.528 + 0.9856003 * n) % 360) * D2R
  const λ = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * D2R
  const ε = (23.439 - 0.0000004 * n) * D2R
  const α = Math.atan2(Math.cos(ε) * Math.sin(λ), Math.cos(λ))
  const δ = Math.asin(Math.sin(ε) * Math.sin(λ))
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24
  const lst = ((gmst + lng / 15) % 24) * 15 * D2R
  const H = lst - α
  const φ = lat * D2R
  const alt = Math.asin(Math.sin(φ) * Math.sin(δ) + Math.cos(φ) * Math.cos(δ) * Math.cos(H))
  const az = Math.atan2(-Math.sin(H), Math.tan(δ) * Math.cos(φ) - Math.sin(φ) * Math.cos(H))
  return { azimuth: ((az * R2D) + 360) % 360, altitude: alt * R2D }
}

export function describeSun(s: SunPosition): string {
  if (s.altitude < -2) return '夜間，無逆光問題'
  const dirs = ['北', '東北', '東', '東南', '南', '西南', '西', '西北']
  const d = dirs[Math.round(s.azimuth / 45) % 8]
  if (s.altitude < 35) return `太陽偏低（${d}方、高度 ${Math.round(s.altitude)}°），朝${d}走會逆光`
  return `太陽偏高（高度 ${Math.round(s.altitude)}°），逆光影響小`
}
