/**
 * Main entry point for the gesture recognition module.
 * Provides a tiny API to start/stop everything cleanly.
 * D4: Event router automatically started at module load.
 */

import * as cam from "./camera";
import * as mp from "./mediapipe";
import { GestureModes } from "./modes";
import * as diag from "./diagnostics";
import * as stemService from "./stemService";
import { setConfig, getConfig } from "./config";
import { startEventRouter, stopEventRouter } from "./router";

export type StartOptions = {
  modelUrl?: string; // default: "/models/hand_landmarker.task"
  fpsHint?: number; // optional: not strictly used, for future tuning
};

let _started = false;
// @ts-expect-error - Detector reference kept for future features
let _detector: GestureModes | null = null;
let _stopLoop: (() => void) | null = null;

// ============================================================================
// D4: Start Event Router (automatically at module load)
// ============================================================================

// Start router once at module load (idempotent, safe for HMR)
// @ts-expect-error - Router stop handle kept but router runs persistently
const _stopRouter = startEventRouter();

// Expose for debugging
if (import.meta.env.DEV) {
  (globalThis as any).__stopEventRouter = stopEventRouter;
  console.log("🔧 Event router control: window.__stopEventRouter()");
}

// ============================================================================
// Gesture Module Lifecycle
// ============================================================================

export async function startGestureModule(opts: StartOptions = {}) {
  if (_started) return; // idempotent
  _started = true;
  const modelUrl = opts.modelUrl ?? "/models/hand_landmarker.task";

  // 1) init model
  await mp.initHandModel(modelUrl);

  // 2) start camera
  await cam.startCamera();

  // 3) start modes loop (returns detector; give us a stop handle)
  const det = new GestureModes();
  _detector = det;

  let stopped = false;
  const loop = () => {
    if (stopped) return;

    // Track frame timing for diagnostics
    diag.tickFrame(performance.now());

    const video = cam.getVideoElement();
    const hands = mp.detectHands(video);

    // D5: Process ALL hands, not just hands[0]
    det.update(hands);

    // D5: Update diagnostics with dual-hand mode info
    const handModes = det.getAllModes();
    if (handModes.length > 0) {
      diag.setHandModes(handModes);
    } else {
      diag.setMode("idle"); // Backward compatibility for no hands
    }

    requestAnimationFrame(loop);
  };
  loop();
  _stopLoop = () => {
    stopped = true;
  };

  // Expose diagnostics toggle during dev
  (globalThis as any).__gestureDiag = diag;

  // Expose stem service for console testing
  (globalThis as any).__stemService = stemService;

  // Expose config for console testing
  (globalThis as any).__gestureConfig = { setConfig, getConfig };

  // Optional: emit a READY event for your teammate, if helpful
  // emit({ type: "PAD_TRIGGER", pad: 1 }); // example only; usually you wouldn't emit on start
}

export async function stopGestureModule() {
  if (!_started) return;
  _started = false;

  try {
    _stopLoop?.();
  } catch {}
  _stopLoop = null;
  _detector = null;

  try {
    await cam.stopCamera();
  } catch {}
  try {
    // If your mediapipe wrapper exposes a cleanup, call it here (optional).
    await mp.closeModel();
  } catch {}

  // Note: Event router keeps running even after gesture module stops
  // This allows manual event emission via bus without gesture detection
  // To stop router manually: window.__stopEventRouter()
}

export function isGestureModuleRunning() {
  return _started;
}

// Re-exports for integrators
export { subscribe, emit } from "./bus";
export type { DJEvent, DeckID } from "./types";

// D2: Export dual-deck audio engines
// D3: Export orchestrator functions for synchronized control
// D6: Export tempo sync functions
export {
  engineA,
  engineB,
  getDeck,
  DeckAudioEngine,
  playBothSync,
  playDeckSync,
  pauseDeck,
  syncTempoA,
  syncTempoB,
  autoSyncTempoIfEnabled,
} from "./audioEngine";
export type { Stems, TrackSource } from "./audioEngine";
