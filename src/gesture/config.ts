/**
 * Centralized configuration for gesture detection tuning.
 * All thresholds, gains, debounces, and rate limits in one place.
 * D5: Added dual-hand mapping and 3-finger blend mode.
 */

export type GestureConfig = {
  // Posture detection thresholds (normalized space)
  pinchEnter: number; // normalized gap to enter pinch
  pinchExit: number; // normalized gap to exit pinch
  fingerUpTau: number; // normalized threshold for finger "up"

  // Rate limiting and debouncing (milliseconds)
  continuousHz: number; // Hz for continuous events (pinch2D)
  transportHoldMs: number; // palm/fist hold duration to trigger PLAY/PAUSE
  transportCooldownMs: number; // cooldown after transport event fires
  stemToggleHoldMs: number; // hold duration to trigger stem toggle
  stemToggleDebounceMs: number; // debounce for stem toggle events
  pinchActivationMs: number; // hold duration before pinch starts controlling
  transportDebounceMs: number; // deprecated, kept for compatibility
  padsDebounceMs: number; // deprecated, kept for compatibility

  // Tempo control (pinch2D vertical movement)
  tempoMin: number; // minimum tempo value
  tempoMax: number; // maximum tempo value
  tempoGain: number; // reserved for future delta-based control

  // Filter control (pinch2D horizontal movement)
  filterMin: number; // minimum filter value
  filterMax: number; // maximum filter value
  filterDeadzone: number; // deadzone threshold
  filterSmoothingAlpha: number; // EMA smoothing factor

  // Scratch sensitivity
  scratchGain: number; // multiplier for scratch delta

  // Video frame reference dimensions
  videoWidth: number; // assumed video width in pixels
  videoHeight: number; // assumed video height in pixels
  activeZoneMargin: number; // margin fraction (0.1 = 10% on each side)

  // D5: Dual-hand mapping (mirrored camera: right hand → Deck A, left hand → Deck B)
  handToDeck: { left: "B"; right: "A" }; // right hand → Deck A, left hand → Deck B

  // D5: 3-finger blend mode (both hands control their respective deck's master level)
  blendHoldMs: number; // hold duration to enter blend mode
  blendRateHz: number; // emit rate while blending (Hz)
  blendSmoothingAlpha: number; // EMA smoothing factor for blend value
  blendMode: "independent" | "crossfade"; // "independent" = each deck separate, "crossfade" = inverse link
  verticalDeadzone: number; // deadzone for vertical motion (reduces jitter)

  // D6: Tempo sync
  autoSyncTempo: boolean; // auto-sync Deck B tempo to Deck A when loading/playing
  tempoSyncSmoothMs: number; // smooth tempo transition duration (ms)

  // Stem separation API (optional)
  stemApiBase?: string; // base URL for stem separation API
  stemApiKey?: string; // API key for stem separation service
  stemPollIntervalMs?: number; // polling interval in ms (default 3000)
  stemPollTimeoutMs?: number; // polling timeout in ms (default 90000)
  stemMockEnabled: boolean; // use mock mode for development (returns local URLs)
  stemMockDelayMs: number; // fake processing delay in mock mode (ms)
};

export const defaultConfig: Readonly<GestureConfig> = Object.freeze({
  pinchEnter: 0.33,
  pinchExit: 0.37,
  fingerUpTau: 0.02,
  continuousHz: 15,
  transportHoldMs: 600,
  transportCooldownMs: 800,
  stemToggleHoldMs: 400,
  stemToggleDebounceMs: 300,
  pinchActivationMs: 100,
  transportDebounceMs: 250, // deprecated
  padsDebounceMs: 300, // deprecated
  tempoMin: 0.8,
  tempoMax: 1.2,
  tempoGain: 0.40,
  filterMin: 0,
  filterMax: 1,
  filterDeadzone: 0.05,
  filterSmoothingAlpha: 0.5,
  scratchGain: 10.0,
  videoWidth: 640,
  videoHeight: 480,
  activeZoneMargin: 0.1,
  // D5: Dual-hand mapping (mirrored: right → A, left → B)
  handToDeck: { left: "B" as const, right: "A" as const },
  // D5: 3-finger blend mode (both hands)
  blendHoldMs: 400,
  blendRateHz: 15,
  blendSmoothingAlpha: 0.4,
  blendMode: "crossfade" as const, // Enable crossfade by default
  verticalDeadzone: 0.05,
  // D6: Tempo sync
  autoSyncTempo: true, // Auto-sync Deck B to Deck A by default
  tempoSyncSmoothMs: 200, // 200ms smooth transition
  // Stem separation
  stemMockEnabled: true, // default: true for dev
  stemMockDelayMs: 2000, // default: 2s fake delay
});

let _current: GestureConfig = { ...defaultConfig };
const _listeners: Array<(cfg: GestureConfig) => void> = [];

export function getConfig(): Readonly<GestureConfig> {
  return Object.freeze({ ..._current });
}

export function setConfig(patch: Partial<GestureConfig>): void {
  _current = { ..._current, ...patch };
  const snapshot = getConfig();
  _listeners.forEach((fn) => fn(snapshot));
}

export function resetConfig(): void {
  _current = { ...defaultConfig };
  const snapshot = getConfig();
  _listeners.forEach((fn) => fn(snapshot));
}

export function onConfigChange(fn: (cfg: GestureConfig) => void): () => void {
  _listeners.push(fn);
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}
