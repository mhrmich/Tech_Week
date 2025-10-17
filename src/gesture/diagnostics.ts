/**
 * Headless diagnostics module for gesture system monitoring.
 * Tracks FPS, dropped frames, gesture modes, and event counts.
 * D5: Enhanced to track both hands (Deck A / Deck B) independently.
 */

import type { DJEvent, DeckID } from "./types";
import type { GestureMode } from "./modes";
import { subscribe } from "./bus";
// D2: BPM tracking removed (was part of GV3 guest vocals)

export type HandModeInfo = {
  handedness: "left" | "right";
  deck: DeckID;
  mode: GestureMode;
};

export type DiagnosticsSnapshot = {
  enabled: boolean;
  fps: number;
  droppedFrames: number;
  mode: GestureMode | "idle"; // Kept for backward compatibility
  handModes: HandModeInfo[]; // D5: Per-hand mode tracking
  eventCounts: Record<string, number>;
  lastPrintedAt: number;
};

// ============================================================================
// Module State
// ============================================================================

let _enabled = false;
let _mode: GestureMode | "idle" = "idle"; // Kept for backward compatibility
let _handModes: HandModeInfo[] = []; // D5: Track both hands independently
let _printEveryMs = 2000;
let _fpsWindowMs = 1000;
let _lastPrintedAt = 0;
let _droppedFrames = 0;

// Frame timing tracking (circular buffer approach)
const _frameTimes: number[] = [];
let _lastFrameTime = 0;

// Event counting
const _eventCounts: Record<string, number> = {};

// ============================================================================
// Public API
// ============================================================================

/**
 * Enable or disable diagnostics logging.
 */
export function enable(on: boolean): void {
  _enabled = on;
  if (on) {
    console.log("🔍 Diagnostics enabled");
  } else {
    console.log("🔍 Diagnostics disabled");
  }
}

/**
 * Check if diagnostics are enabled.
 */
export function isEnabled(): boolean {
  return _enabled;
}

/**
 * Record a frame tick for FPS calculation.
 * Call once per rendered frame.
 */
export function tickFrame(ts: number): void {
  if (!_enabled) return;

  // Detect dropped frames (heuristic: gap > 50ms suggests missed frames)
  if (_lastFrameTime > 0) {
    const delta = ts - _lastFrameTime;
    if (delta > 50) {
      // Rough estimate: each 16.67ms = 1 frame at 60fps
      const missedFrames = Math.floor(delta / 50) - 1;
      if (missedFrames > 0) {
        _droppedFrames += missedFrames;
      }
    }
  }
  _lastFrameTime = ts;

  // Add frame timestamp to buffer
  _frameTimes.push(ts);

  // Remove frames older than the FPS window
  const cutoff = ts - _fpsWindowMs;
  while (_frameTimes.length > 0 && _frameTimes[0] < cutoff) {
    _frameTimes.shift();
  }

  // Print diagnostics if interval elapsed
  if (ts - _lastPrintedAt >= _printEveryMs) {
    printDiagnostics(ts);
    _lastPrintedAt = ts;
  }
}

/**
 * Set the current gesture mode (backward compatibility, single hand).
 */
export function setMode(mode: GestureMode | "idle"): void {
  _mode = mode;
}

/**
 * D5: Set gesture modes for all detected hands.
 */
export function setHandModes(modes: HandModeInfo[]): void {
  _handModes = modes;
}

/**
 * Record an event emission.
 * Called automatically via bus subscription.
 */
export function recordEvent(evt: DJEvent): void {
  if (!_enabled) return;
  const key = evt.type;
  _eventCounts[key] = (_eventCounts[key] || 0) + 1;
}

/**
 * Set the print interval (milliseconds).
 */
export function setPrintIntervalMs(ms: number): void {
  _printEveryMs = ms;
}

/**
 * Set the FPS calculation window (milliseconds).
 */
export function setFpsWindowMs(ms: number): void {
  _fpsWindowMs = ms;
}

/**
 * Get a snapshot of current diagnostics.
 */
export function getSnapshot(): Readonly<DiagnosticsSnapshot> {
  const fps = _frameTimes.length * (1000 / _fpsWindowMs);
  return Object.freeze({
    enabled: _enabled,
    fps,
    droppedFrames: _droppedFrames,
    mode: _mode,
    handModes: [..._handModes],
    eventCounts: { ..._eventCounts },
    lastPrintedAt: _lastPrintedAt,
  });
}

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Print compact diagnostics line.
 * D5: Shows dual-hand status (Deck A / Deck B) when available.
 */
function printDiagnostics(_ts: number): void {
  const fps = _frameTimes.length * (1000 / _fpsWindowMs);

  // D5: Format hand modes if available
  let handStatus = "";
  if (_handModes.length > 0) {
    const deckA = _handModes.find((h) => h.deck === "A");
    const deckB = _handModes.find((h) => h.deck === "B");

    const aPart = deckA ? `A: mode=${deckA.mode}` : "A: idle";
    const bPart = deckB ? `B: mode=${deckB.mode}` : "B: idle";

    handStatus = `${aPart} | ${bPart}`;
  } else {
    // Fallback to single-hand mode for backward compatibility
    handStatus = `mode: ${_mode}`;
  }

  // Format event counts
  const eventParts: string[] = [];
  const eventTypes = [
    "PLAY", "PAUSE", "TEMPO_SET", "FILTER_SWEEP",
    "STEM_TOGGLE", "STEM_LEVEL", "GUEST_VOCALS_LOAD", "CROSSFADER_SET"
  ];

  for (const type of eventTypes) {
    const count = _eventCounts[type] || 0;
    if (count > 0) { // Only show events that have fired
      eventParts.push(`${count} ${type.toLowerCase()}`);
    }
  }

  const eventSummary = eventParts.length > 0 ? eventParts.join(" / ") : "none";

  console.log(
    `diag | ${handStatus} | fps: ${fps.toFixed(1)} | dropped: ${_droppedFrames} | events: ${eventSummary}`
  );
}

// ============================================================================
// Auto-subscribe to Event Bus
// ============================================================================

// Subscribe to all events on module load
subscribe((evt) => {
  if (_enabled) {
    recordEvent(evt);
  }
});
