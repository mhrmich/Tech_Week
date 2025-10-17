/**
 * Headless diagnostics module for gesture system monitoring.
 * Tracks FPS, dropped frames, gesture modes, and event counts.
 */

import type { DJEvent } from "./types";
import type { GestureMode } from "./modes";
import { subscribe } from "./bus";
import { getBpms } from "./audioEngine";

export type DiagnosticsSnapshot = {
  enabled: boolean;
  fps: number;
  droppedFrames: number;
  mode: GestureMode | "idle";
  eventCounts: Record<string, number>;
  lastPrintedAt: number;
};

// ============================================================================
// Module State
// ============================================================================

let _enabled = false;
let _mode: GestureMode | "idle" = "idle";
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
 * Set the current gesture mode.
 */
export function setMode(mode: GestureMode | "idle"): void {
  _mode = mode;
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
    eventCounts: { ..._eventCounts },
    lastPrintedAt: _lastPrintedAt,
  });
}

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * Print compact diagnostics line.
 */
function printDiagnostics(ts: number): void {
  const fps = _frameTimes.length * (1000 / _fpsWindowMs);

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

  const eventSummary = eventParts.join(" / ");

  // Get BPM settings
  const bpms = getBpms();
  const masterBpmStr = bpms.master !== null ? bpms.master.toString() : "—";
  const guestBpmStr = bpms.guest !== null ? bpms.guest.toString() : "—";

  console.log(
    `diag | fps: ${fps.toFixed(1)} | dropped: ${_droppedFrames} | mode: ${_mode} | bpm M:${masterBpmStr} G:${guestBpmStr} | events: ${eventSummary}`
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
