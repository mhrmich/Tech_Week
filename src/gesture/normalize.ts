/**
 * Normalization utilities for hand landmarks.
 * Converts raw pixel coordinates to scale-invariant, centered values.
 */

import type { HandLandmark } from "./mediapipe";

// ============================================================================
// Types
// ============================================================================

export type HandBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
};

export type NormLandmark = {
  x: number;
  y: number;
  z?: number;
};

export type Canonical = {
  wrist: NormLandmark;
  indexTip: NormLandmark;
  indexMcp: NormLandmark;
  thumbTip: NormLandmark;
};

// ============================================================================
// Basic Math Utilities
// ============================================================================

/**
 * Calculate 2D Euclidean distance between two points.
 */
export function dist2D(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Clamp a value between min and max.
 */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

/**
 * Linear interpolation between a and b.
 * @param t - Interpolation factor (0 = a, 1 = b)
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another.
 */
export function mapRange(
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  return ((v - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin;
}

// ============================================================================
// Hand Normalization
// ============================================================================

/**
 * Compute bounding box and center for a set of landmarks.
 *
 * @param landmarks - Array of hand landmarks in pixel coordinates
 * @returns Bounding box with dimensions and center point
 */
export function computeHandBox(landmarks: HandLandmark[]): HandBox {
  if (landmarks.length === 0) {
    return {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
      w: 0,
      h: 0,
      cx: 0,
      cy: 0,
    };
  }

  // Find min/max for x and y
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const lm of landmarks) {
    if (lm.x < minX) minX = lm.x;
    if (lm.x > maxX) maxX = lm.x;
    if (lm.y < minY) minY = lm.y;
    if (lm.y > maxY) maxY = lm.y;
  }

  // Compute dimensions and center
  const w = maxX - minX;
  const h = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return { minX, minY, maxX, maxY, w, h, cx, cy };
}

/**
 * Compute a robust hand scale metric.
 * Uses distance from index MCP (landmark 5) to wrist (landmark 0).
 * Falls back to bounding box size if the distance is too small.
 *
 * @param landmarks - Array of hand landmarks
 * @param box - Optional pre-computed bounding box (for efficiency)
 * @returns Scale value (larger = hand closer to camera / larger hand)
 */
export function computeHandScale(
  landmarks: HandLandmark[],
  box?: HandBox
): number {
  // MediaPipe hand landmark indices:
  // 0 = wrist
  // 5 = index finger MCP (metacarpophalangeal joint)
  const WRIST_IDX = 0;
  const INDEX_MCP_IDX = 5;

  if (landmarks.length < INDEX_MCP_IDX + 1) {
    // Not enough landmarks - fallback to box size
    const b = box || computeHandBox(landmarks);
    return Math.max(b.w, b.h) * 0.5;
  }

  const wrist = landmarks[WRIST_IDX];
  const indexMcp = landmarks[INDEX_MCP_IDX];

  // Calculate distance from index MCP to wrist
  const scale = dist2D(wrist, indexMcp);

  // If scale is too small (edge case), fallback to bbox
  if (scale < 0.01) {
    const b = box || computeHandBox(landmarks);
    return Math.max(b.w, b.h) * 0.5;
  }

  return scale;
}

/**
 * Normalize landmarks relative to hand bounding box center.
 * Converts pixel coordinates to roughly [-1..+1] range centered on the hand.
 *
 * @param landmarks - Raw landmarks in pixel coordinates
 * @param box - Optional pre-computed bounding box (for efficiency)
 * @returns Normalized landmarks, bounding box, and scale
 */
export function normalizeLandmarks(
  landmarks: HandLandmark[],
  box?: HandBox
): { norm: NormLandmark[]; box: HandBox; scale: number } {
  // Compute box if not provided
  const handBox = box || computeHandBox(landmarks);

  // Compute scale for reference
  const scale = computeHandScale(landmarks, handBox);

  // Normalization factor: max dimension / 2
  // This puts most landmarks in roughly [-1..+1] range
  const s = Math.max(handBox.w, handBox.h) / 2 || 1;

  // Normalize each landmark
  const norm: NormLandmark[] = landmarks.map((lm) => ({
    x: (lm.x - handBox.cx) / s,
    y: (lm.y - handBox.cy) / s,
    z: lm.z !== undefined ? lm.z / s : undefined,
  }));

  return { norm, box: handBox, scale };
}

/**
 * Extract canonical/key points from normalized landmarks.
 * Returns commonly used landmarks by name for easier access.
 *
 * MediaPipe hand landmark indices:
 * - 0: wrist
 * - 4: thumb tip
 * - 5: index MCP (metacarpophalangeal joint)
 * - 8: index tip
 *
 * @param norm - Normalized landmarks
 * @returns Object with named canonical points
 */
export function canonicalPoints(norm: NormLandmark[]): Canonical {
  return {
    wrist: norm[0] || { x: 0, y: 0 },
    indexTip: norm[8] || { x: 0, y: 0 },
    indexMcp: norm[5] || { x: 0, y: 0 },
    thumbTip: norm[4] || { x: 0, y: 0 },
  };
}

// Expose for debugging in dev mode
if (import.meta.env.DEV) {
  (window as any).__normalizeModule = {
    computeHandBox,
    computeHandScale,
    normalizeLandmarks,
    canonicalPoints,
    dist2D,
    clamp,
    lerp,
    mapRange,
  };
}
