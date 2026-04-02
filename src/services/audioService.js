/**
 * Ambient audio engine using Web Audio API — no external dependencies
 */
let audioCtx = null
let masterGain = null
let activeNodes = []
let isPlaying = false

const getAudioContext = () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    masterGain = audioCtx.createGain()
    masterGain.gain.setValueAtTime(0.12, audioCtx.currentTime)
    masterGain.connect(audioCtx.destination)
  }
  return audioCtx
}

const createRainDrop = (ctx, destination, delay = 0) => {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const filter = ctx.createBiquadFilter()

  filter.type = 'bandpass'
  filter.frequency.value = 1200 + Math.random() * 2000
  filter.Q.value = 8

  osc.type = 'sine'
  osc.frequency.value = 800 + Math.random() * 1600

  gain.gain.setValueAtTime(0, ctx.currentTime + delay)
  gain.gain.linearRampToValueAtTime(0.3 + Math.random() * 0.2, ctx.currentTime + delay + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.08 + Math.random() * 0.12)

  osc.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  osc.start(ctx.currentTime + delay)
  osc.stop(ctx.currentTime + delay + 0.2)
  return { osc, gain, filter }
}

const createAmbienceNoise = (ctx, destination) => {
  const bufferSize = ctx.sampleRate * 2
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * 0.08
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer
  source.loop = true

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 400

  const gain = ctx.createGain()
  gain.gain.value = 0.4

  source.connect(filter)
  filter.connect(gain)
  gain.connect(destination)
  source.start()

  return { source, filter, gain }
}

const scheduleRain = (ctx, destination) => {
  const scheduleNext = () => {
    if (!isPlaying) return
    const count = 2 + Math.floor(Math.random() * 4)
    for (let i = 0; i < count; i++) {
      const delay = Math.random() * 0.3
      createRainDrop(ctx, destination, delay)
    }
    const nextIn = 150 + Math.random() * 400
    setTimeout(scheduleNext, nextIn)
  }
  scheduleNext()
}

export const startAmbientAudio = async () => {
  if (isPlaying) return
  try {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    isPlaying = true

    const noiseNode = createAmbienceNoise(ctx, masterGain)
    activeNodes.push(noiseNode)
    scheduleRain(ctx, masterGain)
  } catch (e) {
    console.warn('Ambient audio failed:', e)
  }
}

export const stopAmbientAudio = () => {
  isPlaying = false
  activeNodes.forEach(node => {
    try {
      node.source?.stop()
      node.gain?.disconnect()
    } catch {}
  })
  activeNodes = []
  if (masterGain) {
    masterGain.gain.linearRampToValueAtTime(0, audioCtx?.currentTime + 0.5)
    setTimeout(() => {
      masterGain?.gain.setValueAtTime(0.12, audioCtx?.currentTime)
    }, 600)
  }
}

export const setAmbientVolume = (vol) => {
  if (masterGain) {
    masterGain.gain.setTargetAtTime(
      Math.max(0, Math.min(1, vol)) * 0.2,
      audioCtx.currentTime,
      0.1
    )
  }
}

export const isAmbientPlaying = () => isPlaying
