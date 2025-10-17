/**
 * Headless audio engine for DJ gesture control with multi-stem support.
 * Uses Tone.js to manipulate audio based on event bus.
 */

import * as Tone from "tone";
import type { DJEvent } from "./types";
import { subscribe } from "./bus";

export type Stems = { vocals: string; drums: string; bass: string };

// ============================================================================
// Module State
// ============================================================================

let _audioInitialized = false;
let _busSubscribed = false;

// Stem players and per-stem gains
let _players: { vocals: Tone.Player; drums: Tone.Player; bass: Tone.Player } | null = null;
let _gains: { vocals: Tone.Gain; drums: Tone.Gain; bass: Tone.Gain } | null = null;

// Shared mix and filter nodes
let _mixGain: Tone.Gain | null = null;
let _filter: Tone.Filter | null = null;

// Playback state tracking
let _loaded = false;
let _playing = false;
let _lastStartWallTime = 0;
let _lastStartOffsetSec = 0;
let _playbackRate = 1.0;

// Stem mute states
let _stemStates = { vocals: true, drums: true, bass: true };

// Guest vocals player, gain, and state
let _guestPlayer: Tone.Player | null = null;
let _guestGain: Tone.Gain | null = null;
let _guestLoaded = false;
let _guestObjectUrl: string | null = null; // Track object URLs for cleanup

// BPM state for tempo matching
let _masterBpm: number | null = null;
let _guestBpm: number | null = null;
let _tempoFactor = 1.0; // Current tempo factor from TEMPO_SET (default 1.0)
let _guestBpmWarningLogged = false; // Track if we've already logged BPM warning

// ============================================================================
// Rate Calculation Helpers
// ============================================================================

/**
 * Calculate playback rate for master stems.
 * Master rate is simply the tempo factor.
 */
function masterRate(): number {
  return _tempoFactor;
}

/**
 * Calculate playback rate for guest vocals.
 * Guest rate = tempoFactor * (masterBpm / guestBpm) if both BPMs are known.
 * Otherwise falls back to master rate (1:1 ratio).
 */
function guestRate(): number {
  if (!_guestBpm || !_masterBpm) {
    // Fall back to master rate if BPMs are unknown
    if (_guestLoaded && !_guestBpmWarningLogged) {
      console.log("ℹ️ Guest BPM unknown → using masterRate()");
      _guestBpmWarningLogged = true;
    }
    return _tempoFactor;
  }

  if (_guestBpm <= 0) {
    // Guard against invalid BPM
    return _tempoFactor;
  }

  return _tempoFactor * (_masterBpm / _guestBpm);
}

/**
 * Apply current rates to all loaded players.
 * Call this whenever BPM or tempo factor changes.
 */
function applyRates(): void {
  const master = masterRate();
  const guest = guestRate();

  // Apply to main stems
  if (_players?.vocals.buffer.loaded) _players.vocals.playbackRate = master;
  if (_players?.drums.buffer.loaded) _players.drums.playbackRate = master;
  if (_players?.bass.buffer.loaded) _players.bass.playbackRate = master;

  // Apply to guest
  if (_guestPlayer?.buffer.loaded) {
    _guestPlayer.playbackRate = guest;
  }

  // Update tracked playback rate (for position calculation)
  _playbackRate = master;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Initialize audio context and setup audio graph.
 * Must be called from a user gesture (browser autoplay policy).
 */
export async function initAudio(): Promise<void> {
  if (_audioInitialized) {
    console.warn("Audio already initialized");
    return;
  }

  try {
    // Start Tone context (requires user gesture)
    await Tone.start();
    console.log("🔊 Audio context started");

    // Create shared nodes
    _filter = new Tone.Filter({
      type: "lowpass",
      frequency: 8000,
      rolloff: -24,
    });

    _mixGain = new Tone.Gain(1);

    // Connect: MixGain → Filter → Destination
    _mixGain.connect(_filter);
    _filter.toDestination();

    _audioInitialized = true;

    // Subscribe to event bus once
    if (!_busSubscribed) {
      subscribe(handleEvent);
      _busSubscribed = true;
      console.log("🔊 Audio engine subscribed to event bus");
    }
  } catch (error) {
    throw new Error(
      `Failed to initialize audio. Ensure this is called from a user gesture (click/tap). Error: ${error}`
    );
  }
}

/**
 * Verify that an audio URL is accessible.
 * Note: blob: URLs (from uploaded files) are always considered valid.
 */
async function verifyAudio(url: string): Promise<boolean> {
  // Blob URLs (from uploaded files) are always valid
  if (url.startsWith("blob:")) {
    return true;
  }

  // For HTTP URLs, verify with HEAD request
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Load three stems (vocals, drums, bass) for synchronized playback.
 */
export async function loadStems(stems: Stems): Promise<void> {
  if (!_audioInitialized) {
    throw new Error("Audio not initialized. Call initAudio() first.");
  }

  // Unload existing stems
  unloadStems();

  try {
    console.log("🎵 Loading stems...");

    // Verify each stem URL
    const verifications = await Promise.all([
      verifyAudio(stems.vocals),
      verifyAudio(stems.drums),
      verifyAudio(stems.bass),
    ]);

    const [vocalsOk, drumsOk, bassOk] = verifications;
    const loadedStems: string[] = [];
    const missingStem: string[] = [];

    if (!vocalsOk) missingStem.push("vocals");
    else loadedStems.push("vocals");

    if (!drumsOk) missingStem.push("drums");
    else loadedStems.push("drums");

    if (!bassOk) missingStem.push("bass");
    else loadedStems.push("bass");

    // If all stems are missing, throw error
    if (loadedStems.length === 0) {
      throw new Error("❌ No stems loaded – check public/samples/");
    }

    // Create players (will be silent if URL is bad)
    _players = {
      vocals: new Tone.Player({ url: stems.vocals, autostart: false, loop: true }),
      drums: new Tone.Player({ url: stems.drums, autostart: false, loop: true }),
      bass: new Tone.Player({ url: stems.bass, autostart: false, loop: true }),
    };

    // Create per-stem gain nodes (for mute/unmute)
    _gains = {
      vocals: new Tone.Gain(vocalsOk ? 1 : 0),
      drums: new Tone.Gain(drumsOk ? 1 : 0),
      bass: new Tone.Gain(bassOk ? 1 : 0),
    };

    // Connect: Player → Gain → MixGain
    _players.vocals.connect(_gains.vocals);
    _players.drums.connect(_gains.drums);
    _players.bass.connect(_gains.bass);

    _gains.vocals.connect(_mixGain!);
    _gains.drums.connect(_mixGain!);
    _gains.bass.connect(_mixGain!);

    // Load only verified stems
    const loadPromises: Promise<void>[] = [];
    if (vocalsOk) loadPromises.push(_players.vocals.load(stems.vocals));
    if (drumsOk) loadPromises.push(_players.drums.load(stems.drums));
    if (bassOk) loadPromises.push(_players.bass.load(stems.bass));

    await Promise.all(loadPromises);

    // Reset playback state
    _loaded = true;
    _playing = false;
    _lastStartOffsetSec = 0;
    _lastStartWallTime = 0;
    _playbackRate = 1.0;
    _stemStates = { vocals: vocalsOk, drums: drumsOk, bass: bassOk };

    // Apply current rates (including tempo factor and BPM matching)
    applyRates();

    // Log results
    if (loadedStems.length > 0) {
      console.log(`✅ Loaded ${loadedStems.join(" / ")}`);
    }
    if (missingStem.length > 0) {
      missingStem.forEach(stem => {
        console.warn(`⚠️ Missing or bad file: ${stems[stem as keyof Stems]} — muting ${stem}`);
      });
    }
  } catch (error) {
    unloadStems();
    throw new Error(`Failed to load stems: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Unload stems and clean up resources.
 */
export function unloadStems(): void {
  if (_players) {
    _players.vocals.dispose();
    _players.drums.dispose();
    _players.bass.dispose();
    _players = null;
  }

  if (_gains) {
    _gains.vocals.dispose();
    _gains.drums.dispose();
    _gains.bass.dispose();
    _gains = null;
  }

  _loaded = false;
  _playing = false;
  _lastStartOffsetSec = 0;
  _lastStartWallTime = 0;

  console.log("🔊 Stems unloaded");
}

/**
 * Check if stems are currently loaded.
 */
export function isStemsLoaded(): boolean {
  return _loaded;
}

/**
 * Toggle a specific stem on/off (mute/unmute).
 */
export function toggleStem(stem: keyof Stems, enabled: boolean): void {
  if (!_gains) {
    console.warn("⚠️ Cannot toggle stem - stems not loaded");
    return;
  }

  _stemStates[stem] = enabled;
  // Use rampTo for click-free transitions
  _gains[stem].gain.rampTo(enabled ? 1 : 0, 0.02); // 20ms ramp

  console.log(`🎚️ Stem ${stem}: ${enabled ? "ON" : "OFF"}`);
}

/**
 * Get current stem mute states.
 */
export function getStemStates(): { vocals: boolean; drums: boolean; bass: boolean } {
  return { ..._stemStates };
}

// ============================================================================
// Guest Vocals API
// ============================================================================

/**
 * Load a guest vocal track from URL or file.
 * Creates the player, connects to audio graph, and loads the audio.
 */
export async function loadGuestVocals(src: { url?: string; file?: File | Blob }): Promise<void> {
  if (!_audioInitialized || !_mixGain) {
    throw new Error("Audio not initialized. Call initAudio() first.");
  }

  // Unload existing guest if present
  unloadGuestVocals();

  try {
    // Determine URL
    let url: string;
    if (src.file) {
      url = URL.createObjectURL(src.file);
      _guestObjectUrl = url; // Track for cleanup
    } else if (src.url) {
      url = src.url;
    } else {
      throw new Error("Must provide either url or file for guest vocals");
    }

    console.log("🎤 Loading guest vocals...");

    // Create player and gain
    _guestPlayer = new Tone.Player({
      url,
      autostart: false,
      loop: true
    });
    _guestGain = new Tone.Gain(1); // Start at full volume, will be controlled by setGuestEnabled/setGuestLevel

    // Connect: GuestPlayer → GuestGain → MixGain
    _guestPlayer.connect(_guestGain);
    _guestGain.connect(_mixGain);

    // Load the audio
    await _guestPlayer.load(url);

    _guestLoaded = true;

    // Apply current rates (including BPM matching if configured)
    applyRates();

    console.log("✅ Guest vocals loaded");

  } catch (error) {
    unloadGuestVocals();
    throw new Error(`Failed to load guest vocals: ${error instanceof Error ? error.message : error}`);
  }
}

/**
 * Unload guest vocals and clean up resources.
 */
export function unloadGuestVocals(): void {
  if (_guestPlayer) {
    _guestPlayer.dispose();
    _guestPlayer = null;
  }

  if (_guestGain) {
    _guestGain.dispose();
    _guestGain = null;
  }

  // Revoke object URL if we created one
  if (_guestObjectUrl) {
    URL.revokeObjectURL(_guestObjectUrl);
    _guestObjectUrl = null;
  }

  _guestLoaded = false;
  console.log("🔊 Guest vocals unloaded");
}

/**
 * Check if guest vocals are loaded.
 */
export function isGuestLoaded(): boolean {
  return _guestLoaded;
}

/**
 * Enable or disable guest vocals (mute/unmute).
 * @param enabled - true to unmute, false to mute
 * @param rampMs - ramp time in seconds (default 0.03s = 30ms)
 */
export function setGuestEnabled(enabled: boolean, rampMs = 0.03): void {
  if (!_guestGain) {
    console.warn("⚠️ Cannot set guest enabled - guest not loaded");
    return;
  }

  _guestGain.gain.rampTo(enabled ? 1 : 0, rampMs);
  console.log(`🎤 Guest vocals: ${enabled ? "ON" : "OFF"}`);
}

/**
 * Set guest vocals level (volume).
 * @param value01 - level in range [0..1]
 * @param rampMs - ramp time in seconds (default 0.03s = 30ms)
 */
export function setGuestLevel(value01: number, rampMs = 0.03): void {
  if (!_guestGain) {
    console.warn("⚠️ Cannot set guest level - guest not loaded");
    return;
  }

  // Clamp to [0, 1]
  const clamped = Math.max(0, Math.min(1, value01));
  _guestGain.gain.rampTo(clamped, rampMs);
  console.log(`🎤 Guest level: ${clamped.toFixed(2)}`);
}

// ============================================================================
// BPM API
// ============================================================================

/**
 * Set the master track BPM for tempo matching.
 * @param bpm - BPM value (60-200), or null to clear
 */
export function setMasterBpm(bpm: number | null): void {
  if (bpm === null) {
    _masterBpm = null;
    console.log("🎵 Master BPM cleared");
    return;
  }

  // Clamp to sensible range with warning
  if (bpm < 60 || bpm > 200) {
    console.warn(`⚠️ Master BPM ${bpm} outside typical range (60-200), clamping`);
    bpm = Math.max(60, Math.min(200, bpm));
  }

  _masterBpm = bpm;
  console.log(`🎵 Master BPM: ${bpm}`);

  // Apply rates if players are loaded
  applyRates();
}

/**
 * Set the guest vocals BPM for tempo matching.
 * @param bpm - BPM value (60-200), or null to clear
 */
export function setGuestBpm(bpm: number | null): void {
  if (bpm === null) {
    _guestBpm = null;
    _guestBpmWarningLogged = false; // Reset warning flag
    console.log("🎤 Guest BPM cleared");
    return;
  }

  // Clamp to sensible range with warning
  if (bpm < 60 || bpm > 200) {
    console.warn(`⚠️ Guest BPM ${bpm} outside typical range (60-200), clamping`);
    bpm = Math.max(60, Math.min(200, bpm));
  }

  _guestBpm = bpm;
  _guestBpmWarningLogged = false; // Reset warning flag
  console.log(`🎤 Guest BPM: ${bpm}`);

  // Apply rates if players are loaded
  applyRates();
}

/**
 * Get current BPM settings.
 * @returns Object with master and guest BPM values (or null if not set)
 */
export function getBpms(): { master: number | null; guest: number | null } {
  return {
    master: _masterBpm,
    guest: _guestBpm,
  };
}

/**
 * Legacy loadTrack support (for backward compatibility).
 * Loads the same audio as all three stems.
 */
export async function loadTrack(src: { url?: string; file?: File | Blob }): Promise<void> {
  console.warn("⚠️ loadTrack() is deprecated - consider using loadStems() instead");

  // Determine URL
  let url: string;
  if (src.file) {
    url = URL.createObjectURL(src.file);
  } else if (src.url) {
    url = src.url;
  } else {
    throw new Error("Must provide either url or file");
  }

  // Load as all three stems (mono playback)
  await loadStems({
    vocals: url,
    drums: url,
    bass: url,
  });
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handle events from the bus.
 */
function handleEvent(evt: DJEvent): void {
  switch (evt.type) {
    case "PLAY":
      handlePlay();
      break;
    case "PAUSE":
      handlePause();
      break;
    case "TEMPO_SET":
      handleTempoSet(evt.value);
      break;
    case "FILTER_SWEEP":
      handleFilterSweep(evt.value);
      break;
    case "STEM_TOGGLE":
      // Handle both main stems and guest vocals
      if (evt.stem === "guestVocals") {
        setGuestEnabled(evt.enabled);
      } else {
        toggleStem(evt.stem, evt.enabled);
      }
      break;
    case "STEM_LEVEL":
      // Handle level control (primarily for guest vocals)
      if (evt.stem === "guestVocals") {
        setGuestLevel(evt.value);
      }
      break;
    case "GUEST_VOCALS_LOAD":
      loadGuestVocals(evt).catch(err => {
        console.error("❌ Failed to load guest vocals:", err);
      });
      break;
  }
}

/**
 * PLAY: Start or resume playback for all stems in sync.
 */
function handlePlay(): void {
  if (!_loaded || !_players) {
    console.warn("⚠️ Cannot play - stems not loaded");
    return;
  }

  if (_playing) return; // Already playing

  // Start all stems at the same offset for perfect sync
  // Only start players that successfully loaded (have buffers)
  const now = Tone.now();
  if (_players.vocals.buffer.loaded) _players.vocals.start(now, _lastStartOffsetSec);
  if (_players.drums.buffer.loaded) _players.drums.start(now, _lastStartOffsetSec);
  if (_players.bass.buffer.loaded) _players.bass.start(now, _lastStartOffsetSec);

  // Start guest vocals if loaded
  if (_guestPlayer && _guestPlayer.buffer.loaded) {
    _guestPlayer.start(now, _lastStartOffsetSec);
  }

  _playing = true;
  _lastStartWallTime = performance.now();

  console.log(`▶️ Playing from ${_lastStartOffsetSec.toFixed(2)}s`);
}

/**
 * PAUSE: Pause playback for all stems, remember position.
 */
function handlePause(): void {
  if (!_loaded || !_players) return;
  if (!_playing) return; // Already paused

  // Stop all stems (only stop loaded players)
  const now = Tone.now();
  if (_players.vocals.buffer.loaded) _players.vocals.stop(now);
  if (_players.drums.buffer.loaded) _players.drums.stop(now);
  if (_players.bass.buffer.loaded) _players.bass.stop(now);

  // Stop guest vocals if loaded
  if (_guestPlayer && _guestPlayer.buffer.loaded) {
    _guestPlayer.stop(now);
  }

  // Calculate new offset based on elapsed time and playback rate
  const elapsedWall = (performance.now() - _lastStartWallTime) / 1000; // seconds
  _lastStartOffsetSec += elapsedWall * _playbackRate;

  // Wrap around if looping (use first loaded player's duration)
  if (_players.vocals.buffer.loaded) {
    const duration = _players.vocals.buffer.duration;
    _lastStartOffsetSec = _lastStartOffsetSec % duration;
  } else if (_players.drums.buffer.loaded) {
    const duration = _players.drums.buffer.duration;
    _lastStartOffsetSec = _lastStartOffsetSec % duration;
  } else if (_players.bass.buffer.loaded) {
    const duration = _players.bass.buffer.duration;
    _lastStartOffsetSec = _lastStartOffsetSec % duration;
  }

  _playing = false;

  console.log(`⏸️ Paused at ${_lastStartOffsetSec.toFixed(2)}s`);
}

/**
 * TEMPO_SET: Adjust playback rate for all stems.
 * Updates tempo factor and applies BPM-adjusted rates to all players.
 */
function handleTempoSet(value: number): void {
  // Clamp to reasonable range
  const clamped = Math.max(0.5, Math.min(2.0, value));

  // Update tempo factor
  _tempoFactor = clamped;

  // Apply rates to all players (main stems use masterRate(), guest uses guestRate())
  applyRates();

  console.log(`⏩ Tempo: ${clamped.toFixed(2)}x`);
}

/**
 * FILTER_SWEEP: Macro control for lowpass ↔ highpass.
 */
function handleFilterSweep(value: number): void {
  if (!_filter) return;

  // Clamp to [0, 1]
  const v = Math.max(0, Math.min(1, value));

  if (v < 0.5) {
    // Lowpass: 0.0 → 400Hz, 0.5 → 8000Hz
    _filter.type = "lowpass";
    const t = v / 0.5;
    const cutoff = 400 + (8000 - 400) * t;
    _filter.frequency.rampTo(cutoff, 0.05);
  } else {
    // Highpass: 0.5 → 150Hz, 1.0 → 3000Hz
    _filter.type = "highpass";
    const t = (v - 0.5) / 0.5;
    const cutoff = 150 + (3000 - 150) * t;
    _filter.frequency.rampTo(cutoff, 0.05);
  }
}
