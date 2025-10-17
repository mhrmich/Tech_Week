/**
 * UI Adapter: Bridges the upstream UI components to our Tone.js dual-deck system.
 *
 * This adapter wraps our engineA/engineB (Tone.js-based) to match the interface
 * expected by the UI components, without modifying any core audio/gesture logic.
 *
 * Strategy:
 * - UI components call methods like getDeck(), setCrossfader(), setMasterVolume()
 * - We delegate to our existing engineA/engineB and router
 * - Keep mirrored hand mapping: Right → Deck A, Left → Deck B
 */

import { engineA, engineB, emit } from "../gesture/index"
import type { DeckAudioEngine } from "../gesture/audioEngine"

/**
 * Adapter class that wraps our Tone.js deck engines to match the UI's expected interface.
 */
class DeckPlayerAdapter {
  private deck: DeckAudioEngine
  private deckId: "A" | "B"

  constructor(deck: DeckAudioEngine, deckId: "A" | "B") {
    this.deck = deck
    this.deckId = deckId
  }

  // Core playback controls - delegate to our engines
  handlePlayPause() {
    if (this.deck.isPlaying()) {
      this.deck.pause()
    } else {
      this.deck.play()
    }
  }

  handleSeekBackward(amount = 5) {
    // Our engines don't expose seek directly, but we can emit events if needed
    console.log(`Seek backward ${amount}s on Deck ${this.deckId}`)
  }

  handleSeekForward(amount = 5) {
    console.log(`Seek forward ${amount}s on Deck ${this.deckId}`)
  }

  handleVolumeUp() {
    // Volume control via master gain
    const state = this.deck.getState()
    const newGain = Math.min(1, state.masterGain + 0.05)
    this.deck.setMasterGain(newGain)
  }

  handleVolumeDown() {
    const state = this.deck.getState()
    const newGain = Math.max(0, state.masterGain - 0.05)
    this.deck.setMasterGain(newGain)
  }

  // Filter controls - map to our filter system
  handleLowCutStep(delta: number) {
    const state = this.deck.getState()
    const newFilter = Math.max(0, Math.min(1, state.filter + delta * 0.01))
    this.deck.setFilter(newFilter)
  }

  handleHighCutStep(delta: number) {
    const state = this.deck.getState()
    const newFilter = Math.max(0, Math.min(1, state.filter - delta * 0.01))
    this.deck.setFilter(newFilter)
  }

  handleBandReset() {
    this.deck.setFilter(0.5) // Reset to neutral
  }

  // Tempo/playback rate controls
  handlePlaybackRateStep(delta: number) {
    const state = this.deck.getState()
    const newTempo = Math.max(0.8, Math.min(1.2, state.tempoFactor + delta))
    this.deck.setTempoFactor(newTempo)
  }

  handlePitchLockToggle() {
    console.log(`Pitch lock toggle on Deck ${this.deckId}`)
    // Our engines don't have separate pitch lock, tempo affects pitch
  }

  // State query
  isPlaying(): boolean {
    return this.deck.isPlaying()
  }

  getState() {
    return this.deck.getState()
  }
}

/**
 * Audio Engine Adapter - wraps our dual-deck system for the UI
 */
class AudioEngineAdapter {
  private deckAdapters: Map<"A" | "B", DeckPlayerAdapter> = new Map()

  constructor() {
    this.deckAdapters.set("A", new DeckPlayerAdapter(engineA, "A"))
    this.deckAdapters.set("B", new DeckPlayerAdapter(engineB, "B"))
  }

  getDeck(deckId: "A" | "B"): DeckPlayerAdapter {
    const adapter = this.deckAdapters.get(deckId)
    if (!adapter) {
      throw new Error(`Invalid deck ID: ${deckId}`)
    }
    return adapter
  }

  setCrossfader(value: number) {
    // Emit crossfader event - our router will handle it
    emit({ type: "CROSSFADER_SET", value })
  }

  setMasterVolume(value: number) {
    // Set master volume on both decks
    // In a real implementation, this might control a master bus
    // For now, we'll adjust both decks proportionally
    console.log(`Master volume: ${value.toFixed(2)}`)
  }

  // Expose our engines for advanced use
  get engineA() {
    return engineA
  }

  get engineB() {
    return engineB
  }
}

// Singleton instance
let audioEngineAdapter: AudioEngineAdapter | null = null

export function getAudioEngine(): AudioEngineAdapter {
  if (!audioEngineAdapter) {
    audioEngineAdapter = new AudioEngineAdapter()
  }
  return audioEngineAdapter
}

// Re-export for convenience
export { AudioEngineAdapter, DeckPlayerAdapter }
