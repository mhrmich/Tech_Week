/**
 * Smoothing utilities for gesture recognition.
 * Reduces jitter, prevents flicker, and limits event spam.
 */

// ============================================================================
// Types
// ============================================================================

export type Vec2 = {
  x: number;
  y: number;
};

export type Vec3 = {
  x: number;
  y: number;
  z?: number;
};

// ============================================================================
// Exponential Moving Average (EMA)
// ============================================================================

/**
 * Exponential moving average for scalar values.
 * Smooths a single number over time to reduce jitter.
 *
 * @param prev - Previous value (null on first call)
 * @param next - New value
 * @param alpha - Smoothing factor (0-1). Higher = more responsive, less smooth
 * @returns Smoothed value
 */
export function emaScalar(
  prev: number | null,
  next: number,
  alpha: number = 0.5
): number {
  if (prev === null) {
    return next;
  }
  return alpha * next + (1 - alpha) * prev;
}

/**
 * Exponential moving average for 2D vectors.
 * Smooths x and y coordinates independently.
 *
 * @param prev - Previous vector (null on first call)
 * @param next - New vector
 * @param alpha - Smoothing factor (0-1)
 * @returns Smoothed vector
 */
export function emaVec2(
  prev: Vec2 | null,
  next: Vec2,
  alpha: number = 0.5
): Vec2 {
  if (prev === null) {
    return { x: next.x, y: next.y };
  }
  return {
    x: alpha * next.x + (1 - alpha) * prev.x,
    y: alpha * next.y + (1 - alpha) * prev.y,
  };
}

/**
 * Exponential moving average for 3D vectors.
 * Smooths x, y, and z coordinates independently.
 *
 * @param prev - Previous vector (null on first call)
 * @param next - New vector
 * @param alpha - Smoothing factor (0-1)
 * @returns Smoothed vector
 */
export function emaVec3(
  prev: Vec3 | null,
  next: Vec3,
  alpha: number = 0.5
): Vec3 {
  if (prev === null) {
    return { x: next.x, y: next.y, z: next.z };
  }
  return {
    x: alpha * next.x + (1 - alpha) * prev.x,
    y: alpha * next.y + (1 - alpha) * prev.y,
    z: next.z !== undefined && prev.z !== undefined
      ? alpha * next.z + (1 - alpha) * prev.z
      : next.z,
  };
}

// ============================================================================
// Hysteresis Toggle
// ============================================================================

/**
 * Hysteresis toggle to prevent flickering at threshold boundaries.
 * Creates a "dead zone" between enter and exit thresholds.
 *
 * @param prev - Previous state
 * @param value - Current value to check
 * @param enterTh - Threshold to enter ON state
 * @param exitTh - Threshold to exit ON state
 * @param invert - If false (default): smaller values trigger ON (e.g., pinch distance)
 *                 If true: larger values trigger ON (e.g., hand raised)
 * @returns New state
 *
 * @example
 * // Pinch detection (smaller distance = pinched)
 * let pinched = false;
 * pinched = hysteresis(pinched, distance, 0.33, 0.37); // enter at ≤0.33, exit at ≥0.37
 *
 * @example
 * // Hand raised (larger y = raised)
 * let raised = false;
 * raised = hysteresis(raised, handY, 0.7, 0.6, true); // enter at ≥0.7, exit at ≤0.6
 */
export function hysteresis(
  prev: boolean,
  value: number,
  enterTh: number,
  exitTh: number,
  invert?: boolean
): boolean {
  if (!invert) {
    // Smaller values trigger ON (e.g., pinch distance)
    if (!prev && value <= enterTh) {
      return true; // Enter ON state
    }
    if (prev && value >= exitTh) {
      return false; // Exit ON state
    }
  } else {
    // Larger values trigger ON (e.g., hand raised)
    if (!prev && value >= enterTh) {
      return true; // Enter ON state
    }
    if (prev && value <= exitTh) {
      return false; // Exit ON state
    }
  }

  // Stay in current state (within dead zone)
  return prev;
}

// ============================================================================
// Delta Smoothing
// ============================================================================

/**
 * Smooth delta/velocity values with exponential moving average.
 * Identical to emaScalar but semantically separate for clarity.
 *
 * @param prev - Previous delta (null on first call)
 * @param next - New delta
 * @param alpha - Smoothing factor (0-1)
 * @returns Smoothed delta
 */
export function smoothDelta(
  prev: number | null,
  next: number,
  alpha: number = 0.4
): number {
  if (prev === null) {
    return next;
  }
  return alpha * next + (1 - alpha) * prev;
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Create a time-based rate limiter.
 * Returns a function that only executes the callback if enough time has passed.
 *
 * @param hz - Maximum calls per second
 * @returns Function that takes a callback and executes it only if rate limit allows
 *
 * @example
 * const allow = makeRateLimiter(10); // max 10 Hz
 * setInterval(() => {
 *   allow(() => console.log('Called at most 10 times per second'));
 * }, 1);
 */
export function makeRateLimiter(hz: number): (fn: () => void) => void {
  const minInterval = 1000 / hz;
  let lastCall = -Infinity;

  return (fn: () => void): void => {
    const now = performance.now();
    if (now - lastCall >= minInterval) {
      lastCall = now;
      fn();
    }
    // Otherwise skip (too soon)
  };
}
