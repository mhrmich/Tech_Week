import { AudioEngine } from "./audio-engine"

let audioContext: AudioContext | null = null
let audioEngine: AudioEngine | null = null

export function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext is only available in the browser')
  }
  
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  return audioContext
}

export function getAudioEngine(): AudioEngine {
  if (!audioEngine) {
    const ctx = getAudioContext()
    audioEngine = new AudioEngine(ctx)
  }
  return audioEngine
}

export function resumeAudioContext() {
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume()
  }
}
