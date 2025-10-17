/**
 * Audio Context Bridge - connects UI to our Tone.js dual-deck system
 *
 * INTEGRATION STRATEGY:
 * - UI components expect AudioEngine interface (from upstream)
 * - We provide AudioEngineAdapter that wraps our engineA/engineB (Tone.js)
 * - All audio logic stays in src/gesture/** (no changes to core)
 * - This file is the ONLY bridge between UI and our audio system
 */

import { getAudioEngine as getAdapter } from "./audio-adapter"

// Keep a reference to the Web Audio context for compatibility
// (Tone.js manages its own context internally)
let audioContext: AudioContext | null = null

export function getAudioContext(): AudioContext {
  if (typeof window === 'undefined') {
    throw new Error('AudioContext is only available in the browser')
  }

  if (!audioContext) {
    // Create a dummy context for UI compatibility
    // Our Tone.js engines use their own internal context
    audioContext = new AudioContext()
  }
  return audioContext
}

/**
 * Get the audio engine adapter that bridges UI to our dual-deck system.
 * Returns an adapter that wraps engineA/engineB from src/gesture/audioEngine.ts
 */
export function getAudioEngine() {
  return getAdapter()
}

export function resumeAudioContext() {
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume()
  }

  // Also ensure Tone.js context is running
  // (Our engines handle this internally via ensureAudio())
}
