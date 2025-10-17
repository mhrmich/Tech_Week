export class DeckPlayer {
  private audioContext: AudioContext
  private sourceNode: AudioBufferSourceNode | null = null
  private gainNode: GainNode
  private bandFilter: BandFilterControl
  private analyser: AnalyserNode
  private crossfadeGain: GainNode
  private startTime = 0
  private startOffset = 0
  private pauseTime = 0
  private isPlaying = false
  private buffer: AudioBuffer | null = null
  private playbackRate = 1.0
  private pitchLock = false
  private onTimeUpdate?: (time: number) => void
  private animationFrameId: number | null = null

  constructor(audioContext: AudioContext, masterGain: GainNode) {
    this.audioContext = audioContext
    this.gainNode = audioContext.createGain()
    this.analyser = audioContext.createAnalyser()
    this.analyser.fftSize = 2048
    this.analyser.smoothingTimeConstant = 0.8
    this.crossfadeGain = audioContext.createGain()
    this.crossfadeGain.gain.value = 1.0

    this.bandFilter = createBandFilterControl(audioContext)

    this.gainNode.connect(this.bandFilter.lowCut)
    this.bandFilter.lowCut.connect(this.bandFilter.highCut)
    this.bandFilter.highCut.connect(this.analyser)
    this.analyser.connect(this.crossfadeGain)
    this.crossfadeGain.connect(masterGain)
  }

  async loadTrack(buffer: AudioBuffer) {
    this.stop()
    this.buffer = buffer
    this.pauseTime = 0
    this.startOffset = 0
  }

  play() {
    if (!this.buffer || this.isPlaying) return

    this.sourceNode = this.audioContext.createBufferSource()
    this.sourceNode.buffer = this.buffer
    this.sourceNode.playbackRate.value = this.playbackRate
    this.sourceNode.connect(this.gainNode)

    this.startTime = this.audioContext.currentTime
    this.startOffset = this.pauseTime
    this.sourceNode.start(0, this.startOffset)
    this.isPlaying = true

    this.startTimeTracking()
  }

  pause() {
    if (!this.isPlaying) return

    this.pauseTime = this.getCurrentTime()
    this.stop()
  }

  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop()
      } catch (e) {
        // Already stopped
      }
      this.sourceNode.disconnect()
      this.sourceNode = null
    }
    this.isPlaying = false
    this.stopTimeTracking()
  }

  seek(time: number) {
    const wasPlaying = this.isPlaying
    this.stop()
    this.pauseTime = Math.max(0, Math.min(time, this.buffer?.duration || 0))
    if (wasPlaying) {
      this.play()
    }
    this.onTimeUpdate?.(this.pauseTime)
  }

  setVolume(volume: number) {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume))
  }

  setCrossfadeGain(gain: number) {
    const now = this.audioContext.currentTime
    this.crossfadeGain.gain.setTargetAtTime(gain, now, 0.01)
  }

  getMeterData(): { peak: number; rms: number } {
    const bufferLength = this.analyser.fftSize
    const dataArray = new Float32Array(bufferLength)
    this.analyser.getFloatTimeDomainData(dataArray)

    let sumSquares = 0
    let peak = 0

    for (let i = 0; i < bufferLength; i++) {
      const abs = Math.abs(dataArray[i])
      if (abs > peak) peak = abs
      sumSquares += dataArray[i] * dataArray[i]
    }

    const rms = Math.sqrt(sumSquares / bufferLength)
    return { peak, rms }
  }

  setLowCut(percent: number) {
    this.bandFilter.setLowCut(percent)
  }

  setHighCut(percent: number) {
    this.bandFilter.setHighCut(percent)
  }

  resetBand() {
    this.bandFilter.resetBand()
  }

  getLowCutFrequency(): number {
    return this.bandFilter.getLowCutFrequency()
  }

  getHighCutFrequency(): number {
    return this.bandFilter.getHighCutFrequency()
  }

  setPlaybackRate(rate: number) {
    const clampedRate = Math.max(0.5, Math.min(2.0, rate))
    this.playbackRate = clampedRate

    if (this.sourceNode && this.isPlaying) {
      const now = this.audioContext.currentTime
      this.sourceNode.playbackRate.setTargetAtTime(clampedRate, now, 0.02)
    }
  }

  getPlaybackRate(): number {
    return this.playbackRate
  }

  getCurrentTime(): number {
    if (this.isPlaying) {
      const elapsed = (this.audioContext.currentTime - this.startTime) * this.playbackRate
      return this.startOffset + elapsed
    }
    return this.pauseTime
  }

  getDuration(): number {
    return this.buffer?.duration || 0
  }

  getIsPlaying(): boolean {
    return this.isPlaying
  }

  setOnTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdate = callback
  }

  setPitchLock(enabled: boolean) {
    this.pitchLock = enabled
    // TODO: Implement pitch-preserving time stretch (e.g., soundtouchjs)
  }

  getPitchLock(): boolean {
    return this.pitchLock
  }

  private startTimeTracking() {
    const update = () => {
      if (this.isPlaying) {
        const currentTime = this.getCurrentTime()
        this.onTimeUpdate?.(currentTime)

        if (currentTime >= this.getDuration()) {
          this.stop()
          this.pauseTime = 0
          this.startOffset = 0
          this.onTimeUpdate?.(0)
        } else {
          this.animationFrameId = requestAnimationFrame(update)
        }
      }
    }
    this.animationFrameId = requestAnimationFrame(update)
  }

  private stopTimeTracking() {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
  }

  cleanup() {
    this.stop()
    this.crossfadeGain.disconnect()
    this.analyser.disconnect()
    this.bandFilter.highCut.disconnect()
    this.bandFilter.lowCut.disconnect()
    this.gainNode.disconnect()
  }
}

export class AudioEngine {
  private audioContext: AudioContext
  private masterGain: GainNode
  private masterAnalyser: AnalyserNode
  private deckA: DeckPlayer
  private deckB: DeckPlayer

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext
    this.masterGain = audioContext.createGain()
    this.masterGain.gain.value = 0.8
    this.masterAnalyser = audioContext.createAnalyser()
    this.masterAnalyser.fftSize = 2048
    this.masterAnalyser.smoothingTimeConstant = 0.8

    this.masterGain.connect(this.masterAnalyser)
    this.masterAnalyser.connect(audioContext.destination)

    this.deckA = new DeckPlayer(audioContext, this.masterGain)
    this.deckB = new DeckPlayer(audioContext, this.masterGain)
  }

  getDeck(deckId: "A" | "B"): DeckPlayer {
    return deckId === "A" ? this.deckA : this.deckB
  }

  setCrossfader(x: number) {
    const clampedX = Math.max(0, Math.min(1, x))
    const gA = Math.cos((Math.PI / 2) * clampedX)
    const gB = Math.sin((Math.PI / 2) * clampedX)

    this.deckA.setCrossfadeGain(gA)
    this.deckB.setCrossfadeGain(gB)
  }

  setMasterVolume(v: number) {
    const clampedV = Math.max(0, Math.min(1, v))
    const now = this.audioContext.currentTime
    this.masterGain.gain.setTargetAtTime(clampedV, now, 0.01)
  }

  getMasterMeterData(): { peak: number; rms: number } {
    const bufferLength = this.masterAnalyser.fftSize
    const dataArray = new Float32Array(bufferLength)
    this.masterAnalyser.getFloatTimeDomainData(dataArray)

    let sumSquares = 0
    let peak = 0

    for (let i = 0; i < bufferLength; i++) {
      const abs = Math.abs(dataArray[i])
      if (abs > peak) peak = abs
      sumSquares += dataArray[i] * dataArray[i]
    }

    const rms = Math.sqrt(sumSquares / bufferLength)
    return { peak, rms }
  }

  cleanup() {
    this.deckA.cleanup()
    this.deckB.cleanup()
    this.masterAnalyser.disconnect()
    this.masterGain.disconnect()
  }
}

export async function decodeAudioFile(audioContext: AudioContext, file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer()
  return await audioContext.decodeAudioData(arrayBuffer)
}

export function generatePeaks(buffer: AudioBuffer, targetSamples = 1000): number[] {
  const channelData = buffer.getChannelData(0)
  const blockSize = Math.floor(channelData.length / targetSamples)
  const peaks: number[] = []

  for (let i = 0; i < targetSamples; i++) {
    const start = i * blockSize
    const end = start + blockSize
    let max = 0

    for (let j = start; j < end && j < channelData.length; j++) {
      const abs = Math.abs(channelData[j])
      if (abs > max) max = abs
    }

    peaks.push(max)
  }

  return peaks
}

import { createBandFilterControl, type BandFilterControl } from "./filter"
