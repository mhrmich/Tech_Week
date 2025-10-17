/**
 * Main entry point for the gesture recognition module.
 * Provides a tiny API to start/stop everything cleanly.
 */

import * as cam from "./camera";
import * as mp from "./mediapipe";
import { GestureModes } from "./modes";
import { subscribe, emit } from "./bus";
import * as diag from "./diagnostics";
import * as stemService from "./stemService";
import { setConfig, getConfig } from "./config";

export type StartOptions = {
  modelUrl?: string; // default: "/models/hand_landmarker.task"
  fpsHint?: number; // optional: not strictly used, for future tuning
};

let _started = false;
let _detector: GestureModes | null = null;
let _stopLoop: (() => void) | null = null;

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

    if (hands.length) {
      // NOTE: your implementation changed update() to accept HandDetection.
      // So we pass the first hand detection directly here:
      det.update(hands[0]);
      diag.setMode(det.getMode());
    } else {
      diag.setMode("idle");
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
}

export function isGestureModuleRunning() {
  return _started;
}

// Re-exports for integrators
export { subscribe, emit } from "./bus";
export type { DJEvent } from "./types";
export { initAudio, loadStems, unloadStems, isStemsLoaded, toggleStem, getStemStates } from "./audioEngine";
export type { Stems } from "./audioEngine";
