/**
 * Posture detection module.
 * Converts hand landmarks into boolean states and gesture detection.
 */

import type { HandDetection } from "./mediapipe";
import {
  normalizeLandmarks,
  type NormLandmark,
  dist2D,
} from "./normalize";
import { hysteresis } from "./smooth";
import { getConfig } from "./config";

// ============================================================================
// Types
// ============================================================================

export type FingerStates = {
  indexUp: boolean;
  middleUp: boolean;
  ringUp: boolean;
  pinkyUp: boolean;
  thumbNearIndex: boolean; // proximity, not "up"
};

export type Posture = {
  pinch: boolean; // thumb-index pinch with hysteresis
  palm: boolean; // open hand
  fist: boolean; // closed hand
  fingerCount: 0 | 1 | 2 | 3 | 4; // number of non-thumb fingers up (clamped at 4)
  indexOnly: boolean; // index up, others down (thumb ignored)
  metrics: {
    pinchGapNorm: number; // normalized pinch distance (0 = tight pinch)
    handScale: number; // pixels, wrist↔index_mcp distance
  };
};

export type PostureConfig = {
  // Pinch hysteresis thresholds on normalized gap (relative to hand size)
  pinchEnter: number; // e.g. 0.33
  pinchExit: number; // e.g. 0.37
  fingerUpTau: number; // y-threshold in normalized space (e.g. 0.02)
};

export const defaultPostureConfig: PostureConfig = {
  pinchEnter: 0.33,
  pinchExit: 0.37,
  fingerUpTau: 0.02,
};

// ============================================================================
// MediaPipe Hand Landmark Indices
// ============================================================================

const THUMB_TIP = 4;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_PIP = 18;
const PINKY_TIP = 20;

// ============================================================================
// Stateless Helper Functions
// ============================================================================

/**
 * Detect which fingers are up/extended.
 *
 * @param norm - Normalized landmarks (in [-1, 1] range)
 * @param handedness - Left or Right hand
 * @param cfg - Configuration (optional)
 * @returns Finger states
 */
export function fingerStates(
  norm: NormLandmark[],
  _handedness: "Left" | "Right",
  cfg?: PostureConfig
): FingerStates {
  const globalCfg = getConfig();
  const tau = cfg?.fingerUpTau ?? globalCfg.fingerUpTau;

  // Finger is "up" if tip.y < pip.y - tau
  // (y grows downward, so smaller y = higher on screen)

  const indexUp = norm[INDEX_TIP].y < norm[INDEX_PIP].y - tau;
  const middleUp = norm[MIDDLE_TIP].y < norm[MIDDLE_PIP].y - tau;
  const ringUp = norm[RING_TIP].y < norm[RING_PIP].y - tau;
  const pinkyUp = norm[PINKY_TIP].y < norm[PINKY_PIP].y - tau;

  // Thumb proximity: distance between thumb_tip and index_tip
  // Normalized by a typical hand size factor
  const thumbIndexDist = dist2D(norm[THUMB_TIP], norm[INDEX_TIP]);
  const thumbNearIndex = thumbIndexDist < 0.33;

  return {
    indexUp,
    middleUp,
    ringUp,
    pinkyUp,
    thumbNearIndex,
  };
}

/**
 * Count how many non-thumb fingers are up.
 *
 * @param fs - Finger states
 * @returns Count of fingers up (0-4, clamped at 4 since tracking supports max 4 fingers)
 */
export function countFingers(fs: FingerStates): 0 | 1 | 2 | 3 | 4 {
  let count = 0;
  if (fs.indexUp) count++;
  if (fs.middleUp) count++;
  if (fs.ringUp) count++;
  if (fs.pinkyUp) count++;
  // Note: thumb is not counted as it's noisy for "up" detection
  // Clamp to 4 since tracking effectively supports max 4 fingers (treat 4 as palm)
  return Math.min(count, 4) as 0 | 1 | 2 | 3 | 4;
}

/**
 * Detect if hand is in "palm" position (open hand).
 * All four fingers up and not pinching.
 *
 * @param fs - Finger states
 * @param pinching - Current pinch state
 * @returns True if palm open
 */
export function isPalm(fs: FingerStates, pinching: boolean): boolean {
  return (
    fs.indexUp && fs.middleUp && fs.ringUp && fs.pinkyUp && !pinching
  );
}

/**
 * Detect if hand is in "fist" position (closed hand).
 * All four fingers down.
 *
 * @param fs - Finger states
 * @returns True if fist
 */
export function isFist(fs: FingerStates): boolean {
  return !fs.indexUp && !fs.middleUp && !fs.ringUp && !fs.pinkyUp;
}

/**
 * Calculate normalized pinch gap between thumb and index finger.
 * Returns value in normalized coordinate space, where smaller = tighter pinch.
 * Typical values: pinched ≈ 0.1-0.3, open ≈ 0.5-1.5
 *
 * @param norm - Normalized landmarks (already in [-1, 1] space)
 * @returns Gap distance in normalized space
 */
export function pinchGapNorm(norm: NormLandmark[]): number {
  const thumbTip = norm[THUMB_TIP];
  const indexTip = norm[INDEX_TIP];

  // Calculate distance in normalized space
  const gap = dist2D(thumbTip, indexTip);

  return gap;
}

// ============================================================================
// Stateful Posture Detector
// ============================================================================

/**
 * Posture detector with stateful pinch hysteresis.
 * Converts hand detections into stable gesture states.
 */
export class PostureDetector {
  private config: PostureConfig;
  private _pinch: boolean = false;

  constructor(cfg?: Partial<PostureConfig>) {
    this.config = {
      ...defaultPostureConfig,
      ...cfg,
    };
  }

  /**
   * Update posture detection with new hand data.
   *
   * @param det - Hand detection from MediaPipe
   * @returns Current posture state
   */
  update(det: HandDetection): Posture {
    // Normalize landmarks
    const { norm, scale } = normalizeLandmarks(det.landmarks);

    // Calculate pinch gap (in normalized space)
    const gap = pinchGapNorm(norm);

    // Get current config (allows hot-reloading of thresholds)
    const globalCfg = getConfig();
    const pinchEnter = this.config.pinchEnter ?? globalCfg.pinchEnter;
    const pinchExit = this.config.pinchExit ?? globalCfg.pinchExit;

    // Apply hysteresis to pinch state
    // invert=false because smaller gap = pinched
    this._pinch = hysteresis(
      this._pinch,
      gap,
      pinchEnter,
      pinchExit,
      false
    );

    // Detect finger states
    const fs = fingerStates(norm, det.handedness, this.config);

    // Count fingers
    const fingerCount = countFingers(fs);

    // Detect gestures
    const palm = isPalm(fs, this._pinch);
    const fist = isFist(fs);
    const indexOnly = fs.indexUp && !fs.middleUp && !fs.ringUp && !fs.pinkyUp;

    return {
      pinch: this._pinch,
      palm,
      fist,
      fingerCount,
      indexOnly,
      metrics: {
        pinchGapNorm: gap,
        handScale: scale,
      },
    };
  }
}

// Expose for debugging in dev mode
if (import.meta.env.DEV) {
  (window as any).__postureModule = {
    PostureDetector,
    fingerStates,
    countFingers,
    isPalm,
    isFist,
    pinchGapNorm,
  };
}
