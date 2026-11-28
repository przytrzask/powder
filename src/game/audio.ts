// Short samples are synthesized into AudioBuffers once, then played like regular sample files.
// To use recorded sounds instead, decode .wav files into the same `samples` map.

type SampleName = 'jump' | 'bigJump' | 'land' | 'crash' | 'trick' | 'bank' | 'gate' | 'finish'

let ctx: AudioContext | null = null
let master: GainNode
let windGain: GainNode
let carveGain: GainNode
let samples: Record<SampleName, AudioBuffer> | null = null

function render(context: AudioContext, seconds: number, fn: (t: number, rand: () => number) => number) {
  const rate = context.sampleRate
  const buf = context.createBuffer(1, Math.floor(seconds * rate), rate)
  const data = buf.getChannelData(0)
  let seed = 7
  const rand = () => ((seed = (seed * 16_807) % 2_147_483_647) / 2_147_483_647) * 2 - 1
  for (let i = 0; i < data.length; i++) data[i] = fn(i / rate, rand)
  return buf
}

const tone = (t: number, f: number) => Math.sin(2 * Math.PI * f * t)
const env = (t: number, attack: number, decay: number) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay))

function notes(freqs: number[], step: number, decay: number) {
  return (t: number) => {
    let sum = 0
    for (const [i, f] of freqs.entries()) {
      const lt = t - i * step
      if (lt >= 0) sum += (tone(lt, f) * 0.6 + tone(lt, f * 2) * 0.15) * env(lt, 0.005, decay)
    }
    return sum * 0.35
  }
}

function buildSamples(context: AudioContext): Record<SampleName, AudioBuffer> {
  // one-pole lowpass state for noise shaping
  let lp = 0
  const lowNoise = (rand: () => number, k: number) => (lp += (rand() - lp) * k)
  // built in this order on purpose: the noise filter state carries over from one sample to the next
  const jump = render(context, 0.35, (t, r) => lowNoise(r, 0.08 + t * 0.5) * env(t, 0.03, 0.1) * 1.4)
  const bigJump = render(context, 0.6, (t, r) => lowNoise(r, 0.05 + t * 0.4) * env(t, 0.06, 0.18) * 1.6)
  const land = render(context, 0.3, (t, r) => (tone(t, 70 - t * 80) * 0.8 + lowNoise(r, 0.3) * 0.6) * env(t, 0.002, 0.07))
  const crash = render(context, 0.9, (t, r) => (tone(t, 55) * 0.7 * env(t, 0.002, 0.12) + lowNoise(r, 0.25) * env(t, 0.005, 0.3)) * 0.9)
  return {
    jump,
    bigJump,
    land,
    crash,
    trick: render(context, 0.5, notes([660, 880], 0.07, 0.12)),
    gate: render(context, 0.35, notes([1320], 0, 0.1)),
    bank: render(context, 0.9, notes([523, 659, 784, 1047], 0.08, 0.2)),
    finish: render(context, 1.8, notes([392, 523, 659, 784, 1047, 1319], 0.12, 0.35)),
  }
}

function loop(context: AudioContext, buffer: AudioBuffer, filter: BiquadFilterNode) {
  const src = context.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const gain = context.createGain()
  gain.gain.value = 0
  src.connect(filter).connect(gain).connect(master)
  src.start()
  return gain
}

export function initAudio() {
  if (ctx) {
    void ctx.resume()
    return
  }
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = 0.6
  master.connect(ctx.destination)
  samples = buildSamples(ctx)

  const noise = render(ctx, 2, (_t, r) => r())
  const windFilter = ctx.createBiquadFilter()
  windFilter.type = 'lowpass'
  windFilter.frequency.value = 500
  windGain = loop(ctx, noise, windFilter)
  const carveFilter = ctx.createBiquadFilter()
  carveFilter.type = 'bandpass'
  carveFilter.frequency.value = 2200
  carveFilter.Q.value = 0.8
  carveGain = loop(ctx, noise, carveFilter)
}

export function play(name: SampleName, volume = 1) {
  if (!ctx || !samples) return
  const src = ctx.createBufferSource()
  src.buffer = samples[name]
  const gain = ctx.createGain()
  gain.gain.value = volume
  src.connect(gain).connect(master)
  src.start()
}

/** Continuous layers: wind follows speed, snow hiss follows carving. */
export function updateAmbience(speed: number, carve: number, airborne: boolean) {
  if (!ctx) return
  const now = ctx.currentTime
  windGain.gain.setTargetAtTime(Math.min(0.5, speed / 60) * (airborne ? 1.4 : 1), now, 0.1)
  carveGain.gain.setTargetAtTime(airborne ? 0 : Math.min(0.35, carve * speed * 0.012 + speed * 0.002), now, 0.05)
}

export function silence() {
  if (!ctx) return
  windGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
  carveGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1)
}
