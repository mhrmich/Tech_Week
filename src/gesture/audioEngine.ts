/**
 * D2: Dual-deck audio engine with independent DeckAudioEngine instances.
 * Each deck owns its players, gains, filter, and position clock.
 * D3: Added synchronized timing methods and orchestrator functions.
 * No event bus wiring yet (that's D4).
 */

import * as Tone from "tone";
import { getConfig } from "./config";

export type Stems = { vocals?: string; drums?: string; bass?: string };
export type TrackSource = { url?: string; file?: File | Blob };

// ============================================================================
// Global Tone.js State (shared across decks)
// ============================================================================

let _toneStarted = false;

async function ensureToneStarted(): Promise<void> {
  if (_toneStarted) return;
  await Tone.start();
  _toneStarted = true;
  console.log("🔊 Tone.js audio context started");
}

/**
 * Verify that an audio URL is accessible.
 * Blob URLs are always considered valid.
 */
async function verifyAudioUrl(url: string): Promise<boolean> {
  if (url.startsWith("blob:")) return true;

  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// ============================================================================
// DeckAudioEngine Class
// ============================================================================

/**
 * Independent audio engine for one deck (A or B).
 * Handles stems or full-mix playback with independent tempo/filter/gains.
 */
export class DeckAudioEngine {
  // Deck identity
  private id: "A" | "B";

  // Audio nodes
  private players: Map<string, Tone.Player> = new Map();
  private stemGains: Map<string, Tone.Gain> = new Map();
  private stemsMixGain: Tone.Gain | null = null;
  private filter: Tone.Filter | null = null;
  private masterGain: Tone.Gain | null = null;
  private limiter: Tone.Limiter | null = null;

  // State
  private loaded = false;
  private playing = false;
  private tempoFactor = 1.0;
  private filterValue = 0.5; // 0..1 (0=lowpass min, 0.5=neutral, 1=highpass max)
  private masterGainValue = 1.0;
  private stemStates: Map<string, boolean> = new Map(); // enabled state

  // Transport clock
  private lastStartWallTime = 0;
  private lastStartOffsetSec = 0;

  // Object URLs for cleanup
  private objectUrls: Set<string> = new Set();

  constructor(id: "A" | "B") {
    this.id = id;
    // Deck B starts muted
    this.masterGainValue = id === "B" ? 0 : 1;
  }

  // ==========================================================================
  // Lifecycle
  // ==========================================================================

  async ensureAudio(): Promise<void> {
    await ensureToneStarted();

    // Create audio graph if not already created
    if (!this.stemsMixGain) {
      this.stemsMixGain = new Tone.Gain(1);
      this.filter = new Tone.Filter({
        type: "lowpass",
        frequency: 8000,
        rolloff: -24,
      });
      this.masterGain = new Tone.Gain(this.masterGainValue);
      this.limiter = new Tone.Limiter(-1); // -1dB threshold

      // Connect chain: stemsMixGain → filter → masterGain → limiter → destination
      this.stemsMixGain.connect(this.filter);
      this.filter.connect(this.masterGain);
      this.masterGain.connect(this.limiter);
      this.limiter.toDestination();

      console.log(`✅ Deck ${this.id}: Audio graph created (master gain: ${this.masterGainValue})`);
    }
  }

  dispose(): void {
    // Stop playback
    if (this.playing) {
      this.pause();
    }

    // Dispose all players
    this.players.forEach(player => player.dispose());
    this.players.clear();

    // Dispose all stem gains
    this.stemGains.forEach(gain => gain.dispose());
    this.stemGains.clear();

    // Dispose graph nodes
    this.stemsMixGain?.dispose();
    this.filter?.dispose();
    this.masterGain?.dispose();
    this.limiter?.dispose();

    this.stemsMixGain = null;
    this.filter = null;
    this.masterGain = null;
    this.limiter = null;

    // Revoke object URLs
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();

    this.loaded = false;
    this.stemStates.clear();

    console.log(`🗑️ Deck ${this.id}: Disposed`);
  }

  // ==========================================================================
  // Loading
  // ==========================================================================

  async loadStems(stems: Stems): Promise<void> {
    await this.ensureAudio();
    this.unload();

    const stemNames: (keyof Stems)[] = ["vocals", "drums", "bass"];
    const loadPromises: Promise<unknown>[] = [];
    const loadedStems: string[] = [];
    const failedStems: string[] = [];

    for (const stemName of stemNames) {
      const url = stems[stemName];
      if (!url) continue;

      // Verify URL
      const isValid = await verifyAudioUrl(url);
      if (!isValid) {
        failedStems.push(stemName);
        console.warn(`⚠️ Deck ${this.id}: ${stemName} URL invalid/unreachable: ${url}`);
        continue;
      }

      // Create player and gain
      const player = new Tone.Player({
        url,
        autostart: false,
        loop: true,
      });
      const gain = new Tone.Gain(1); // Start enabled

      // Connect: player → gain → stemsMixGain
      player.connect(gain);
      gain.connect(this.stemsMixGain!);

      this.players.set(stemName, player);
      this.stemGains.set(stemName, gain);
      this.stemStates.set(stemName, true); // enabled by default

      loadPromises.push(player.load(url));
      loadedStems.push(stemName);
    }

    if (loadPromises.length === 0) {
      throw new Error(`Deck ${this.id}: No valid stems to load`);
    }

    await Promise.all(loadPromises);

    // Apply current tempo to all players
    this.players.forEach(player => {
      if (player.buffer.loaded) {
        player.playbackRate = this.tempoFactor;
      }
    });

    this.loaded = true;
    this.lastStartOffsetSec = 0;
    this.playing = false;

    console.log(`✅ Deck ${this.id}: Loaded stems [${loadedStems.join(", ")}]`);
    if (failedStems.length > 0) {
      console.warn(`⚠️ Deck ${this.id}: Failed stems [${failedStems.join(", ")}]`);
    }

    // D6: Auto-sync tempo if enabled and this is Deck B
    if (this.id === "B") {
      const cfg = getConfig();
      if (cfg.autoSyncTempo && engineA.isLoaded()) {
        const tempoA = engineA.getTempoFactor();
        this.setTempoFactor(tempoA);
        console.log(`🔗 Auto-sync: Deck B tempo → ${tempoA.toFixed(2)}x (matched to Deck A)`);
      }
    }
  }

  async loadFullMix(src: TrackSource): Promise<void> {
    await this.ensureAudio();
    this.unload();

    // Determine URL
    let url: string;
    if (src.file) {
      url = URL.createObjectURL(src.file);
      this.objectUrls.add(url);
    } else if (src.url) {
      url = src.url;
    } else {
      throw new Error(`Deck ${this.id}: Must provide url or file`);
    }

    // Verify URL
    const isValid = await verifyAudioUrl(url);
    if (!isValid) {
      throw new Error(`Deck ${this.id}: Full mix URL invalid/unreachable: ${url}`);
    }

    // Create single player (no per-stem control)
    const player = new Tone.Player({
      url,
      autostart: false,
      loop: true,
    });

    // Connect directly to stemsMixGain (no per-stem gain needed)
    player.connect(this.stemsMixGain!);

    await player.load(url);
    player.playbackRate = this.tempoFactor;

    this.players.set("fullMix", player);
    this.loaded = true;
    this.lastStartOffsetSec = 0;
    this.playing = false;

    console.log(`✅ Deck ${this.id}: Loaded full mix`);
  }

  unload(): void {
    // Stop if playing
    if (this.playing) {
      this.pause();
    }

    // Dispose players and gains
    this.players.forEach(player => player.dispose());
    this.players.clear();

    this.stemGains.forEach(gain => gain.dispose());
    this.stemGains.clear();

    // Revoke object URLs
    this.objectUrls.forEach(url => URL.revokeObjectURL(url));
    this.objectUrls.clear();

    this.loaded = false;
    this.stemStates.clear();
    this.lastStartOffsetSec = 0;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // ==========================================================================
  // Transport
  // ==========================================================================

  play(): void {
    if (!this.loaded) {
      console.warn(`⚠️ Deck ${this.id}: Cannot play - not loaded`);
      return;
    }

    if (this.playing) return; // Already playing

    const now = Tone.now();

    // Start all loaded players at current offset
    this.players.forEach(player => {
      if (player.buffer.loaded) {
        player.start(now, this.lastStartOffsetSec);
      }
    });

    this.playing = true;
    this.lastStartWallTime = performance.now();

    console.log(`▶️ Deck ${this.id}: Playing from ${this.lastStartOffsetSec.toFixed(2)}s`);
  }

  pause(): void {
    if (!this.loaded) return;
    if (!this.playing) return; // Already paused

    const now = Tone.now();

    // Stop all players
    this.players.forEach(player => {
      if (player.buffer.loaded) {
        player.stop(now);
      }
    });

    // Update offset based on elapsed time
    const elapsedWall = (performance.now() - this.lastStartWallTime) / 1000;
    this.lastStartOffsetSec += elapsedWall * this.tempoFactor;

    // Wrap around if we have a duration
    const firstPlayer = this.players.values().next().value as Tone.Player | undefined;
    if (firstPlayer?.buffer.loaded) {
      const duration = firstPlayer.buffer.duration;
      this.lastStartOffsetSec = this.lastStartOffsetSec % duration;
    }

    this.playing = false;

    console.log(`⏸️ Deck ${this.id}: Paused at ${this.lastStartOffsetSec.toFixed(2)}s`);
  }

  isPlaying(): boolean {
    return this.playing;
  }

  // ==========================================================================
  // D3: Precise Timing Methods
  // ==========================================================================

  /**
   * Returns the current playback offset in seconds.
   * Computed from lastStartOffsetSec + elapsed * tempoFactor when playing,
   * or just lastStartOffsetSec when paused.
   */
  getOffsetSeconds(): number {
    if (!this.loaded) return 0;

    if (this.playing) {
      // Compute elapsed time since last start
      const elapsedWall = (performance.now() - this.lastStartWallTime) / 1000;
      const offset = this.lastStartOffsetSec + elapsedWall * this.tempoFactor;

      // Clamp to duration if available
      const firstPlayer = this.players.values().next().value as Tone.Player | undefined;
      if (firstPlayer?.buffer.loaded) {
        const duration = firstPlayer.buffer.duration;
        return offset % duration;
      }

      return offset;
    }

    // Paused: return stored offset
    return this.lastStartOffsetSec;
  }

  /**
   * Start this deck at a specific Tone.now() time.
   * Uses the current offset without recomputing it.
   * Caller controls the schedule.
   */
  playAt(when: number): void {
    if (!this.loaded) {
      console.warn(`⚠️ Deck ${this.id}: Cannot playAt - not loaded`);
      return;
    }

    if (this.playing) {
      // Stop first if already playing
      const now = Tone.now();
      this.players.forEach(player => {
        if (player.buffer.loaded) {
          player.stop(now);
        }
      });
    }

    // Clamp offset to valid range
    const firstPlayer = this.players.values().next().value as Tone.Player | undefined;
    if (firstPlayer?.buffer.loaded) {
      const duration = firstPlayer.buffer.duration;
      this.lastStartOffsetSec = this.lastStartOffsetSec % duration;
    }

    // Start all players at the scheduled time
    this.players.forEach(player => {
      if (player.buffer.loaded) {
        player.start(when, this.lastStartOffsetSec);
      }
    });

    this.playing = true;
    // Record wall time at the scheduled start (adjust for lookahead)
    this.lastStartWallTime = performance.now() + (when - Tone.now()) * 1000;

    console.log(`▶️ Deck ${this.id}: Scheduled start at ${when.toFixed(3)}s (offset: ${this.lastStartOffsetSec.toFixed(2)}s)`);
  }

  /**
   * Pause immediately and update offset using elapsed time.
   */
  pauseNow(): void {
    if (!this.loaded) return;
    if (!this.playing) return; // Already paused

    const now = Tone.now();

    // Stop all players immediately
    this.players.forEach(player => {
      if (player.buffer.loaded) {
        player.stop(now);
      }
    });

    // Update offset based on elapsed time
    const elapsedWall = (performance.now() - this.lastStartWallTime) / 1000;
    this.lastStartOffsetSec += elapsedWall * this.tempoFactor;

    // Wrap around if we have a duration
    const firstPlayer = this.players.values().next().value as Tone.Player | undefined;
    if (firstPlayer?.buffer.loaded) {
      const duration = firstPlayer.buffer.duration;
      this.lastStartOffsetSec = this.lastStartOffsetSec % duration;
    }

    this.playing = false;

    console.log(`⏸️ Deck ${this.id}: Paused at ${this.lastStartOffsetSec.toFixed(2)}s`);
  }

  // ==========================================================================
  // Tempo & Filter
  // ==========================================================================

  setTempoFactor(value: number): void {
    const cfg = getConfig();
    const clamped = Math.max(cfg.tempoMin, Math.min(cfg.tempoMax, value));

    this.tempoFactor = clamped;

    // Apply to all loaded players
    this.players.forEach(player => {
      if (player.buffer.loaded) {
        player.playbackRate = clamped;
      }
    });

    console.log(`⏩ Deck ${this.id}: Tempo ${clamped.toFixed(2)}x`);
  }

  getTempoFactor(): number {
    return this.tempoFactor;
  }

  setFilter(value01: number): void {
    if (!this.filter) return;

    const v = Math.max(0, Math.min(1, value01));
    this.filterValue = v;

    if (v < 0.5) {
      // Lowpass: 0.0 → 400Hz, 0.5 → 8000Hz
      this.filter.type = "lowpass";
      const t = v / 0.5;
      const cutoff = 400 + (8000 - 400) * t;
      this.filter.frequency.rampTo(cutoff, 0.05);
    } else {
      // Highpass: 0.5 → 150Hz, 1.0 → 3000Hz
      this.filter.type = "highpass";
      const t = (v - 0.5) / 0.5;
      const cutoff = 150 + (3000 - 150) * t;
      this.filter.frequency.rampTo(cutoff, 0.05);
    }
  }

  // ==========================================================================
  // Gains
  // ==========================================================================

  setMasterGain(value01: number, rampMs = 0.03): void {
    if (!this.masterGain) return;

    const clamped = Math.max(0, Math.min(1, value01));
    this.masterGainValue = clamped;
    this.masterGain.gain.rampTo(clamped, rampMs);

    console.log(`🔊 Deck ${this.id}: Master gain ${clamped.toFixed(2)}`);
  }

  setStemEnabled(stem: keyof Stems, enabled: boolean, rampMs = 0.02): void {
    const gain = this.stemGains.get(stem);
    if (!gain) {
      console.warn(`⚠️ Deck ${this.id}: Stem ${stem} not loaded`);
      return;
    }

    this.stemStates.set(stem, enabled);
    gain.gain.rampTo(enabled ? 1 : 0, rampMs);

    console.log(`🎚️ Deck ${this.id}: ${stem} ${enabled ? "ON" : "OFF"}`);
  }

  setStemLevel(stem: keyof Stems, value01: number, rampMs = 0.02): void {
    const gain = this.stemGains.get(stem);
    if (!gain) {
      console.warn(`⚠️ Deck ${this.id}: Stem ${stem} not loaded`);
      return;
    }

    const clamped = Math.max(0, Math.min(1, value01));
    gain.gain.rampTo(clamped, rampMs);

    console.log(`🎚️ Deck ${this.id}: ${stem} level ${clamped.toFixed(2)}`);
  }

  // ==========================================================================
  // State Query
  // ==========================================================================

  getState() {
    const stemStates: { vocals?: boolean; drums?: boolean; bass?: boolean } = {};

    if (this.stemStates.has("vocals")) stemStates.vocals = this.stemStates.get("vocals");
    if (this.stemStates.has("drums")) stemStates.drums = this.stemStates.get("drums");
    if (this.stemStates.has("bass")) stemStates.bass = this.stemStates.get("bass");

    return {
      id: this.id,
      loaded: this.loaded,
      playing: this.playing,
      tempoFactor: this.tempoFactor,
      filter: this.filterValue,
      masterGain: this.masterGainValue,
      stems: stemStates,
    };
  }
}

// ============================================================================
// Deck Instances
// ============================================================================

export const engineA = new DeckAudioEngine("A");
export const engineB = new DeckAudioEngine("B");

export function getDeck(id: "A" | "B"): DeckAudioEngine {
  return id === "A" ? engineA : engineB;
}

// ============================================================================
// D3: Orchestrator Functions (Synchronized Control)
// ============================================================================

/**
 * Start both decks at the same audio quantum for sample-accurate synchronization.
 * Uses Tone.now() + 50ms lookahead to ensure both decks start together.
 */
export function playBothSync(): void {
  const when = Tone.now() + 0.05; // 50ms lookahead

  if (engineA.isLoaded()) {
    engineA.playAt(when);
  } else {
    console.warn("⚠️ playBothSync: Deck A not loaded");
  }

  if (engineB.isLoaded()) {
    engineB.playAt(when);
  } else {
    console.warn("⚠️ playBothSync: Deck B not loaded");
  }

  console.log(`🎵 Both decks scheduled to start at ${when.toFixed(3)}s`);
}

/**
 * Start a single deck with lookahead for click-free playback.
 * Uses 30ms lookahead by default.
 */
export function playDeckSync(id: "A" | "B"): void {
  const deck = getDeck(id);

  if (!deck.isLoaded()) {
    console.warn(`⚠️ playDeckSync: Deck ${id} not loaded`);
    return;
  }

  const when = Tone.now() + 0.03; // 30ms lookahead
  deck.playAt(when);
}

/**
 * Pause a single deck immediately.
 */
export function pauseDeck(id: "A" | "B"): void {
  const deck = getDeck(id);

  if (!deck.isLoaded()) {
    console.warn(`⚠️ pauseDeck: Deck ${id} not loaded`);
    return;
  }

  deck.pauseNow();
}

// ============================================================================
// D6: Tempo Sync Functions
// ============================================================================

/**
 * Sync Deck B's tempo to match Deck A's current tempo.
 * Uses smooth ramping if configured.
 */
export function syncTempoB(): void {
  if (!engineA.isLoaded()) {
    console.warn("⚠️ syncTempoB: Deck A not loaded");
    return;
  }

  if (!engineB.isLoaded()) {
    console.warn("⚠️ syncTempoB: Deck B not loaded");
    return;
  }

  const tempoA = engineA.getTempoFactor();
  engineB.setTempoFactor(tempoA);

  console.log(`🔗 Tempo sync: Deck B → ${tempoA.toFixed(2)}x (matched to Deck A)`);
}

/**
 * Sync Deck A's tempo to match Deck B's current tempo.
 * Uses smooth ramping if configured.
 */
export function syncTempoA(): void {
  if (!engineA.isLoaded()) {
    console.warn("⚠️ syncTempoA: Deck A not loaded");
    return;
  }

  if (!engineB.isLoaded()) {
    console.warn("⚠️ syncTempoA: Deck B not loaded");
    return;
  }

  const tempoB = engineB.getTempoFactor();
  engineA.setTempoFactor(tempoB);

  console.log(`🔗 Tempo sync: Deck A → ${tempoB.toFixed(2)}x (matched to Deck B)`);
}

/**
 * Auto-sync Deck B to Deck A if autoSyncTempo is enabled.
 * Called automatically when Deck B loads or plays.
 */
export function autoSyncTempoIfEnabled(): void {
  const cfg = getConfig();

  if (!cfg.autoSyncTempo) return;

  if (engineA.isLoaded() && engineB.isLoaded()) {
    syncTempoB();
  }
}

// Expose for console testing
if (import.meta.env.DEV) {
  (globalThis as any).__decks = { A: engineA, B: engineB };
  (globalThis as any).__deckControl = {
    playBothSync,
    playDeckSync,
    pauseDeck,
    syncTempoB,
    syncTempoA,
    autoSyncTempoIfEnabled,
  };
  console.log("🔧 Deck engines available: window.__decks.A / window.__decks.B");
  console.log("🔧 Deck controls available: window.__deckControl");
}
