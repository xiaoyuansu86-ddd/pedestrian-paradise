/**
 * 加速度計量化路面平整度：
 * 取垂直方向加速度扣除重力後的 RMS，以 2 秒視窗平均；
 * 步行在平整路面 RMS 約 1.5–2.5 m/s²，坑洞／階梯會出現 >4 的尖峰。
 * （已實作，尚未真機驗證 — 門檻值需現場校正）
 */
export interface MotionStats {
  rms: number
  samples: number
  spikes: number
  /** 0 平整 / 1 普通 / 2 顛簸 */
  roughness: 0 | 1 | 2
  supported: boolean
  permission: 'granted' | 'denied' | 'unknown'
}

type Listener = (s: MotionStats) => void

export class MotionSensor {
  private sumSq = 0
  private n = 0
  private spikes = 0
  private listeners = new Set<Listener>()
  private handler = (ev: DeviceMotionEvent) => {
    const a = ev.accelerationIncludingGravity
    if (!a || a.x == null || a.y == null || a.z == null) return
    const mag = Math.hypot(a.x, a.y, a.z)
    const dev = Math.abs(mag - 9.81)
    this.sumSq += dev * dev
    this.n++
    if (dev > 4.5) this.spikes++
    if (this.n % 30 === 0) this.emit()
  }
  private timer: number | null = null
  permission: MotionStats['permission'] = 'unknown'

  get supported() {
    return typeof window !== 'undefined' && 'DeviceMotionEvent' in window
  }

  async start(): Promise<boolean> {
    if (!this.supported) return false
    // iOS 需要使用者手勢後請求權限
    const DME = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<'granted' | 'denied'> }
    if (typeof DME.requestPermission === 'function') {
      try {
        const r = await DME.requestPermission()
        this.permission = r
        if (r !== 'granted') return false
      } catch {
        this.permission = 'denied'
        return false
      }
    } else this.permission = 'granted'
    window.addEventListener('devicemotion', this.handler)
    this.timer = window.setInterval(() => this.emit(), 2000)
    return true
  }

  stop() {
    window.removeEventListener('devicemotion', this.handler)
    if (this.timer) window.clearInterval(this.timer)
    this.timer = null
  }

  reset() {
    this.sumSq = 0
    this.n = 0
    this.spikes = 0
  }

  stats(): MotionStats {
    const rms = this.n ? Math.sqrt(this.sumSq / this.n) : 0
    const roughness: 0 | 1 | 2 = rms > 3.6 || this.spikes > 12 ? 2 : rms > 2.6 || this.spikes > 4 ? 1 : 0
    return { rms, samples: this.n, spikes: this.spikes, roughness, supported: this.supported, permission: this.permission }
  }

  onChange(l: Listener) {
    this.listeners.add(l)
    return () => this.listeners.delete(l)
  }
  private emit() {
    const s = this.stats()
    this.listeners.forEach((l) => l(s))
  }
}
