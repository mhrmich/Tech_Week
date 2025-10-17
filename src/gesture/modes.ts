/**
 * Gesture mode state machines.
 * Interprets postures into continuous or discrete DJ events.
 */

import { PostureDetector, type Posture } from "./posture";
import { emit } from "./bus";
import { normalizeLandmarks } from "./normalize";
import { mapRange, clamp } from "./normalize";
import type { HandDetection } from "./mediapipe";
import { getConfig } from "./config";

export type GestureMode = "idle" | "transport" | "pinch2D" | "stems";

/**
 * Gesture mode detector with mutual exclusion and rate limiting.
 * Processes hand postures into DJ control events.
 */
export class GestureModes {
  private posture = new PostureDetector();
  private mode: GestureMode = "idle";
  private lastContinuousEmit = 0; // for rate limiting continuous events

  // Track previous positions for pinch2D delta calculations
  private prevThumbTip: { x: number; y: number } | null = null;

  // Transport hold tracking
  private transportHoldStartTime: number | null = null;
  private lastTransportState: "palm" | "fist" | null = null;
  private lastTransportEmit = 0;

  // Stem toggle state (track which stems are enabled)
  private stemStates = {
    vocals: true,
    drums: true,
    bass: true,
  };
  private lastStemFingerCount = 0;
  private lastStemToggle = 0;

  /**
   * Update gesture mode based on hand detection.
   * Mode priority (highest to lowest):
   * 1. Pinch → "pinch2D"
   * 2. Palm/Fist (with hold) → "transport"
   * 3. FingerCount 1/2/3 → "stems"
   *
   * @param det - Hand detection from MediaPipe
   */
  update(det: HandDetection): void {
    // Get posture states
    const p = this.posture.update(det);

    // Absolute coordinates for pinch2D position
    const absIndexTip = det.landmarks[8];
    const absThumbTip = det.landmarks[4];

    // Reset mode to idle each frame
    this.mode = "idle";

    // Mode priority: check highest priority first

    if (p.pinch) {
      // Priority 1: Pinch2D mode (use absolute coordinates)
      this.mode = "pinch2D";
      this.handlePinch2D(absIndexTip, absThumbTip);
      // Reset transport and stem state when in pinch
      this.transportHoldStartTime = null;
      this.lastTransportState = null;
      this.lastStemFingerCount = 0;
    } else if (p.palm || p.fist) {
      // Priority 2: Transport mode (with hold + cooldown)
      this.mode = "transport";
      this.handleTransport(p.palm, p.fist);
      this.lastStemFingerCount = 0;
    } else if (p.fingerCount >= 1 && p.fingerCount <= 3) {
      // Priority 3: Stems mode (1 or 2 fingers; 3 fingers ignored)
      this.mode = "stems";
      this.handleStems(p.fingerCount);
      // Reset transport state when in stems
      this.transportHoldStartTime = null;
      this.lastTransportState = null;
    } else {
      // No gesture detected - reset state
      this.transportHoldStartTime = null;
      this.lastTransportState = null;
      this.lastStemFingerCount = 0;
    }

    // Update previous positions for next frame (if in continuous mode)
    if (this.mode === "pinch2D") {
      this.prevThumbTip = { x: absThumbTip.x, y: absThumbTip.y };
    }
  }

  /**
   * Transport mode: sustained PLAY/PAUSE with hold + cooldown.
   * Palm must be held for transportHoldMs to trigger PLAY.
   * Fist must be held for transportHoldMs to trigger PAUSE.
   * After firing, cooldown prevents another event for transportCooldownMs.
   */
  private handleTransport(palm: boolean, fist: boolean): void {
    const cfg = getConfig();
    const now = performance.now();

    // Check cooldown - prevent events during cooldown period
    if (now - this.lastTransportEmit < cfg.transportCooldownMs) {
      return;
    }

    // Determine current state
    const currentState = palm ? "palm" : fist ? "fist" : null;

    // If state changed, reset hold timer
    if (currentState !== this.lastTransportState) {
      this.transportHoldStartTime = now;
      this.lastTransportState = currentState;
      return;
    }

    // If no valid state, clear hold
    if (!currentState) {
      this.transportHoldStartTime = null;
      return;
    }

    // Check if hold duration met
    if (this.transportHoldStartTime === null) {
      this.transportHoldStartTime = now;
      return;
    }

    const holdDuration = now - this.transportHoldStartTime;
    if (holdDuration < cfg.transportHoldMs) {
      // Still holding, not long enough yet
      return;
    }

    // Hold threshold met - emit event
    if (palm) {
      emit({ type: "PLAY" });
      this.lastTransportEmit = now;
      // Reset to prevent repeated firing
      this.transportHoldStartTime = null;
    } else if (fist) {
      emit({ type: "PAUSE" });
      this.lastTransportEmit = now;
      // Reset to prevent repeated firing
      this.transportHoldStartTime = null;
    }
  }

  /**
   * Pinch2D mode: continuous TEMPO_SET + FILTER_SWEEP.
   * - Vertical indexTip.y (absolute camera position) → TEMPO_SET
   * - Horizontal thumbTip.x (absolute camera position) → FILTER_SWEEP
   * Rate-limited based on config.
   */
  private handlePinch2D(
    indexTip: { x: number; y: number },
    thumbTip: { x: number; y: number }
  ): void {
    const cfg = getConfig();
    const now = performance.now();

    // Rate limit continuous events
    const intervalMs = 1000 / cfg.continuousHz;
    if (now - this.lastContinuousEmit < intervalMs) return;
    this.lastContinuousEmit = now;

    // Define active range (central area where hand typically appears)
    const xMin = cfg.videoWidth * cfg.activeZoneMargin;
    const xMax = cfg.videoWidth * (1 - cfg.activeZoneMargin);
    const yMin = cfg.videoHeight * cfg.activeZoneMargin;
    const yMax = cfg.videoHeight * (1 - cfg.activeZoneMargin);

    // Map indexTip.y (vertical position) to TEMPO_SET
    // y in pixel space: 0 = top, height = bottom
    // Top of frame (low y) → faster tempo (max)
    // Bottom of frame (high y) → slower tempo (min)
    const tempo = mapRange(indexTip.y, yMin, yMax, cfg.tempoMax, cfg.tempoMin);
    const tempoClamp = clamp(tempo, cfg.tempoMin, cfg.tempoMax);

    // Map thumbTip.x (horizontal position) to FILTER_SWEEP
    // x in pixel space: 0 = left, width = right
    const filter = mapRange(thumbTip.x, xMin, xMax, cfg.filterMin, cfg.filterMax);
    const filterClamp = clamp(filter, cfg.filterMin, cfg.filterMax);

    // Emit both events
    emit({ type: "TEMPO_SET", value: tempoClamp });
    emit({ type: "FILTER_SWEEP", value: filterClamp });
  }

  /**
   * Stems mode: toggle stems based on finger count.
   * 1 finger → vocals
   * 2 fingers → instrumental (drums + bass together)
   * 3 fingers → nothing (ignored)
   * Debounced to prevent spam when holding the same count.
   */
  private handleStems(fingerCount: number): void {
    const cfg = getConfig();
    const now = performance.now();

    // Only handle 1 or 2 fingers (3 fingers does nothing)
    if (fingerCount < 1 || fingerCount > 2) return;

    // Check debounce
    if (fingerCount === this.lastStemFingerCount && now - this.lastStemToggle < cfg.stemToggleDebounceMs) {
      // Same count, still within debounce window
      return;
    }

    // If finger count changed or debounce expired, emit toggle
    if (fingerCount !== this.lastStemFingerCount) {
      if (fingerCount === 1) {
        // Toggle vocals
        this.stemStates.vocals = !this.stemStates.vocals;
        emit({ type: "STEM_TOGGLE", stem: "vocals", enabled: this.stemStates.vocals });
      } else if (fingerCount === 2) {
        // Toggle instrumental (drums + bass together)
        const newState = !this.stemStates.drums; // Use drums state to track instrumental
        this.stemStates.drums = newState;
        this.stemStates.bass = newState;

        // Emit both events
        emit({ type: "STEM_TOGGLE", stem: "drums", enabled: newState });
        emit({ type: "STEM_TOGGLE", stem: "bass", enabled: newState });
      }

      // Update tracking
      this.lastStemFingerCount = fingerCount;
      this.lastStemToggle = now;
    }
  }

  /**
   * Get the current active gesture mode.
   * Useful for debugging and UI visualization.
   */
  getMode(): GestureMode {
    return this.mode;
  }
}

/**
 * Start the gesture modes loop.
 * Connects camera/MediaPipe detection to the GestureModes state machine.
 *
 * @param detector - GestureModes instance (creates new if not provided)
 * @param intervalMs - Unused (uses RAF, kept for API compatibility)
 * @returns The detector instance for inspection
 */
export async function startModesLoop(
  detector = new GestureModes(),
  intervalMs = 33
): Promise<GestureModes> {
  const cam = await import("./camera");
  const mp = await import("./mediapipe");

  const loop = () => {
    const hands = mp.detectHands(cam.getVideoElement());
    if (hands.length) {
      detector.update(hands[0]);
    }
    requestAnimationFrame(loop);
  };

  loop();
  return detector;
}

// Expose for debugging in dev mode
if (import.meta.env.DEV) {
  (window as any).__modesModule = {
    GestureModes,
    startModesLoop,
  };
}
