/**
 * Gesture mode state machines.
 * Interprets postures into continuous or discrete DJ events.
 *
 * D1: Events now support optional `deck?: DeckID` field.
 * D5: Per-hand processing with deck tagging (left → A, right → B).
 *     Added 3-finger blend mode for right hand → Deck B master level.
 */

import { PostureDetector } from "./posture";
import { emit } from "./bus";
import { mapRange, clamp } from "./normalize";
import type { HandDetection } from "./mediapipe";
import { getConfig } from "./config";
import type { DeckID } from "./types";

export type GestureMode = "idle" | "transport" | "pinch2D" | "stems" | "blend";

/**
 * Per-hand state tracking for independent gesture processing.
 */
class HandState {
  handedness: "left" | "right";
  deck: DeckID;
  mode: GestureMode = "idle";
  posture = new PostureDetector();

  // Pinch tracking
  pinchStartTime: number | null = null;
  lastContinuousEmit = 0;
  prevThumbTip: { x: number; y: number } | null = null;

  // Transport tracking
  transportHoldStartTime: number | null = null;
  lastTransportState: "palm" | "fist" | null = null;
  lastTransportEmit = 0;

  // Stem toggle tracking
  stemStates = { vocals: true, drums: true, bass: true };
  stemHoldStartTime: number | null = null;
  stemHoldFingerCount: number | null = null;
  stemGestureActive: boolean = false; // Tracks if gesture cycle is active (prevents re-trigger while held)

  // Blend tracking (3-finger mode for right hand → Deck B)
  blendActive: boolean = false;
  blendHoldStartTime: number | null = null;
  blendValue: number = 0.5; // EMA-smoothed blend value (0..1)
  lastBlendEmit = 0;

  constructor(handedness: "left" | "right", deck: DeckID) {
    this.handedness = handedness;
    this.deck = deck;
  }

  /**
   * Update gesture mode based on hand detection.
   * Mode priority (highest to lowest):
   * 1. Pinch → "pinch2D"
   * 2. Palm/Fist (with hold) → "transport"
   * 3. 3 fingers (right hand only, with hold) → "blend"
   * 4. FingerCount 1/2 → "stems"
   * 5. Idle
   */
  update(det: HandDetection): void {
    const p = this.posture.update(det);
    const now = performance.now();

    // Absolute coordinates for pinch2D and blend
    const absIndexTip = det.landmarks[8];
    const absThumbTip = det.landmarks[4];

    // Reset mode to idle each frame
    this.mode = "idle";

    // Priority 1: Pinch2D (highest priority - blocks all others)
    if (p.pinch) {
      this.mode = "pinch2D";
      this.handlePinch2D(absIndexTip, absThumbTip, now);
      // Reset other modes
      this.transportHoldStartTime = null;
      this.lastTransportState = null;
      this.stemHoldStartTime = null;
      this.stemHoldFingerCount = null;
      this.stemGestureActive = false;
      this.blendActive = false;
      this.blendHoldStartTime = null;
      return;
    }

    // Priority 2: Transport (palm/fist with hold)
    if (p.palm || p.fist) {
      this.mode = "transport";
      this.handleTransport(p.palm, p.fist, now);
      // Reset other modes
      this.pinchStartTime = null;
      this.stemHoldStartTime = null;
      this.stemHoldFingerCount = null;
      this.stemGestureActive = false;
      this.blendActive = false;
      this.blendHoldStartTime = null;
      return;
    }

    // Priority 3: Blend mode (3 fingers, both hands)
    // D6: Enable 3-finger blend for both hands to control their respective deck's master volume
    if (p.fingerCount === 3) {
      this.mode = "blend";
      this.handleBlend(absIndexTip, now);
      // Reset other modes
      this.pinchStartTime = null;
      this.transportHoldStartTime = null;
      this.lastTransportState = null;
      this.stemHoldStartTime = null;
      this.stemHoldFingerCount = null;
      this.stemGestureActive = false;
      return;
    }

    // Priority 4: Stem toggles (1 or 2 fingers)
    if (p.fingerCount >= 1 && p.fingerCount <= 2) {
      this.mode = "stems";
      this.handleStems(p.fingerCount, now);
      // Reset other modes
      this.pinchStartTime = null;
      this.transportHoldStartTime = null;
      this.lastTransportState = null;
      this.blendActive = false;
      this.blendHoldStartTime = null;
      return;
    }

    // Priority 5: Idle - reset all state
    this.pinchStartTime = null;
    this.transportHoldStartTime = null;
    this.lastTransportState = null;
    this.stemHoldStartTime = null;
    this.stemHoldFingerCount = null;
    this.stemGestureActive = false;
    this.blendActive = false;
    this.blendHoldStartTime = null;
  }

  /**
   * Reset gesture tracking when hand is no longer detected.
   * Keeps stem states but clears active gesture timers.
   */
  resetGestureTracking(): void {
    this.mode = "idle";
    this.pinchStartTime = null;
    this.prevThumbTip = null;
    this.lastContinuousEmit = 0;
    this.transportHoldStartTime = null;
    this.lastTransportState = null;
    this.lastTransportEmit = 0;
    this.stemHoldStartTime = null;
    this.stemHoldFingerCount = null;
    this.stemGestureActive = false; // CRITICAL: Reset so next gesture can fire
    this.blendActive = false;
    this.blendHoldStartTime = null;
    this.blendValue = 0.5;
    this.lastBlendEmit = 0;
    // NOTE: stemStates are NOT reset - they persist across hand detection gaps
  }

  /**
   * Transport mode: sustained PLAY/PAUSE with hold + cooldown.
   */
  private handleTransport(palm: boolean, fist: boolean, now: number): void {
    const cfg = getConfig();

    // Check cooldown
    if (now - this.lastTransportEmit < cfg.transportCooldownMs) {
      return;
    }

    const currentState = palm ? "palm" : fist ? "fist" : null;

    // If state changed, reset hold timer
    if (currentState !== this.lastTransportState) {
      this.transportHoldStartTime = now;
      this.lastTransportState = currentState;
      return;
    }

    if (!currentState) {
      this.transportHoldStartTime = null;
      return;
    }

    if (this.transportHoldStartTime === null) {
      this.transportHoldStartTime = now;
      return;
    }

    const holdDuration = now - this.transportHoldStartTime;
    if (holdDuration < cfg.transportHoldMs) {
      return;
    }

    // Hold threshold met - emit event with deck tag
    if (palm) {
      emit({ type: "PLAY", deck: this.deck });
      this.lastTransportEmit = now;
      this.transportHoldStartTime = null;
    } else if (fist) {
      emit({ type: "PAUSE", deck: this.deck });
      this.lastTransportEmit = now;
      this.transportHoldStartTime = null;
    }
  }

  /**
   * Pinch2D mode: continuous TEMPO_SET + FILTER_SWEEP.
   * Requires holding pinch for pinchActivationMs before activating.
   */
  private handlePinch2D(
    indexTip: { x: number; y: number },
    thumbTip: { x: number; y: number },
    now: number
  ): void {
    const cfg = getConfig();

    // Track pinch start time
    if (this.pinchStartTime === null) {
      this.pinchStartTime = now;
      return;
    }

    // Check if pinch has been held long enough
    const holdDuration = now - this.pinchStartTime;
    if (holdDuration < cfg.pinchActivationMs) {
      return;
    }

    // Rate limit continuous events
    const intervalMs = 1000 / cfg.continuousHz;
    if (now - this.lastContinuousEmit < intervalMs) return;
    this.lastContinuousEmit = now;

    // Define active range
    const xMin = cfg.videoWidth * cfg.activeZoneMargin;
    const xMax = cfg.videoWidth * (1 - cfg.activeZoneMargin);
    const yMin = cfg.videoHeight * cfg.activeZoneMargin;
    const yMax = cfg.videoHeight * (1 - cfg.activeZoneMargin);

    // Map vertical position to tempo
    const tempo = mapRange(indexTip.y, yMin, yMax, cfg.tempoMax, cfg.tempoMin);
    const tempoClamp = clamp(tempo, cfg.tempoMin, cfg.tempoMax);

    // Map horizontal position to filter
    const filter = mapRange(thumbTip.x, xMin, xMax, cfg.filterMin, cfg.filterMax);
    const filterClamp = clamp(filter, cfg.filterMin, cfg.filterMax);

    // Emit events with deck tag
    emit({ type: "TEMPO_SET", value: tempoClamp, deck: this.deck });
    emit({ type: "FILTER_SWEEP", value: filterClamp, deck: this.deck });

    // Update previous position
    this.prevThumbTip = { x: thumbTip.x, y: thumbTip.y };
  }

  /**
   * Blend mode: 3-finger hold (both hands) → deck-specific master level control.
   * Vertical motion sets that deck's "master" level continuously (0..1).
   * D6: Supports both "independent" and "crossfade" modes.
   * - "independent": Each deck's volume is independent
   * - "crossfade": Raising one deck automatically lowers the other (inverse link)
   */
  private handleBlend(indexTip: { x: number; y: number }, now: number): void {
    const cfg = getConfig();

    // Entry: hold 3 fingers for blendHoldMs
    if (!this.blendActive) {
      if (this.blendHoldStartTime === null) {
        this.blendHoldStartTime = now;
        return;
      }

      const holdDuration = now - this.blendHoldStartTime;
      if (holdDuration < cfg.blendHoldMs) {
        return; // Still holding, not long enough yet
      }

      // Entered blend mode
      this.blendActive = true;
      console.log(`🎚️ [${this.deck}] Entered blend mode (3-finger hold)`);
    }

    // Rate limit blend events
    const intervalMs = 1000 / cfg.blendRateHz;
    if (now - this.lastBlendEmit < intervalMs) return;
    this.lastBlendEmit = now;

    // Map vertical position to [0, 1]
    const yMin = cfg.videoHeight * cfg.activeZoneMargin;
    const yMax = cfg.videoHeight * (1 - cfg.activeZoneMargin);

    // Vertical position: top (low y) = 1.0, bottom (high y) = 0.0
    let rawValue = mapRange(indexTip.y, yMin, yMax, 1.0, 0.0);
    rawValue = clamp(rawValue, 0, 1);

    // Apply vertical deadzone (reduce jitter near 0.5)
    const center = 0.5;
    if (Math.abs(rawValue - center) < cfg.verticalDeadzone) {
      rawValue = center;
    }

    // Apply EMA smoothing
    const alpha = cfg.blendSmoothingAlpha;
    this.blendValue = alpha * rawValue + (1 - alpha) * this.blendValue;

    // Emit event based on blend mode
    if (cfg.blendMode === "independent") {
      // Independent mode: control this deck's master gain only
      emit({
        type: "STEM_LEVEL",
        stem: "master" as any,
        value: this.blendValue,
        deck: this.deck,
      });
    } else if (cfg.blendMode === "crossfade") {
      // Crossfade mode: emit CROSSFADER_SET event
      // Router will handle inverse volume linking
      // Value represents this deck's desired level
      const crossfadeValue = this.deck === "A" ? this.blendValue : 1.0 - this.blendValue;
      emit({
        type: "CROSSFADER_SET",
        value: crossfadeValue,
        deck: this.deck, // Tag which deck is controlling the crossfader
      });
    }
  }

  /**
   * Stems mode: toggle stems based on finger count.
   * 1 finger → vocals
   * 2 fingers → instrumental (drums + bass together)
   *
   * State-machine approach:
   * - Gesture must be held for stemToggleHoldMs (150ms) before firing
   * - Toggle fires exactly once per gesture cycle
   * - While stemGestureActive=true, no further toggles occur (prevents re-trigger)
   * - Gesture ends when hand returns to idle or enters different mode
   * - No cooldown needed - state machine handles all timing cleanly
   */
  private handleStems(fingerCount: number, now: number): void {
    const cfg = getConfig();

    // Only handle 1 or 2 fingers
    if (fingerCount < 1 || fingerCount > 2) return;

    // If gesture already active (toggle already fired this cycle), block further toggles
    if (this.stemGestureActive) {
      return;
    }

    // Gesture not active yet - check hold threshold

    // If finger count changed during hold, restart hold timer for stability
    if (fingerCount !== this.stemHoldFingerCount) {
      this.stemHoldStartTime = now;
      this.stemHoldFingerCount = fingerCount;
      return;
    }

    // Initialize hold timer if not started
    if (this.stemHoldStartTime === null) {
      this.stemHoldStartTime = now;
      return;
    }

    // Check if hold threshold met
    const holdDuration = now - this.stemHoldStartTime;
    if (holdDuration < cfg.stemToggleHoldMs) {
      return; // Still holding, threshold not met yet
    }

    // Hold threshold met - fire toggle and activate gesture lock
    if (fingerCount === 1) {
      // Toggle vocals
      this.stemStates.vocals = !this.stemStates.vocals;
      emit({
        type: "STEM_TOGGLE",
        stem: "vocals",
        enabled: this.stemStates.vocals,
        deck: this.deck,
      });
      console.log(`🎤 [${this.deck}] Vocals: ${this.stemStates.vocals ? "ON" : "OFF"}`);
    } else if (fingerCount === 2) {
      // Toggle instrumental (drums + bass together)
      const newState = !this.stemStates.drums;
      this.stemStates.drums = newState;
      this.stemStates.bass = newState;

      emit({ type: "STEM_TOGGLE", stem: "drums", enabled: newState, deck: this.deck });
      emit({ type: "STEM_TOGGLE", stem: "bass", enabled: newState, deck: this.deck });
      console.log(`🎸 [${this.deck}] Instrumental: ${newState ? "ON" : "OFF"}`);
    }

    // Mark gesture as active to prevent re-triggering while held
    // This flag will be reset when hand goes to idle or enters different mode
    this.stemGestureActive = true;
  }
}

/**
 * Gesture mode detector with per-hand state tracking.
 * Processes multiple hands independently and emits deck-tagged events.
 */
export class GestureModes {
  private hands: Map<string, HandState> = new Map();

  /**
   * Update gesture modes for all detected hands.
   * Each hand is processed independently with its own state machine.
   *
   * @param detections - Array of hand detections from MediaPipe
   */
  update(detections: HandDetection[]): void {
    const cfg = getConfig();
    const activeHands = new Set<string>();

    // Process each detected hand
    for (const det of detections) {
      // Get hand identifier and deck mapping
      const handedness = det.handedness.toLowerCase() as "left" | "right";
      const deck = cfg.handToDeck[handedness] || "A"; // Default to A if unknown

      // Get or create hand state
      if (!this.hands.has(handedness)) {
        this.hands.set(handedness, new HandState(handedness, deck));
      }

      const handState = this.hands.get(handedness)!;
      handState.update(det);
      activeHands.add(handedness);
    }

    // Reset gesture tracking for hands that are no longer detected
    // IMPORTANT: We keep the HandState to preserve stem states, but reset gesture timers
    for (const [key, handState] of this.hands) {
      if (!activeHands.has(key)) {
        handState.resetGestureTracking();
      }
    }
  }

  /**
   * Get the current active gesture mode for a specific hand.
   * Useful for debugging and diagnostics.
   */
  getMode(handedness: "left" | "right" = "left"): GestureMode {
    return this.hands.get(handedness)?.mode || "idle";
  }

  /**
   * Get all active hands and their modes.
   * Useful for diagnostics display.
   */
  getAllModes(): { handedness: "left" | "right"; deck: DeckID; mode: GestureMode }[] {
    const result: { handedness: "left" | "right"; deck: DeckID; mode: GestureMode }[] = [];
    for (const [_key, state] of this.hands) {
      result.push({
        handedness: state.handedness,
        deck: state.deck,
        mode: state.mode,
      });
    }
    return result;
  }
}

/**
 * Start the gesture modes loop.
 * Connects camera/MediaPipe detection to the GestureModes state machine.
 * D5: Now processes all detected hands, not just the first one.
 *
 * @param detector - GestureModes instance (creates new if not provided)
 * @param intervalMs - Unused (uses RAF, kept for API compatibility)
 * @returns The detector instance for inspection
 */
export async function startModesLoop(
  detector = new GestureModes(),
  _intervalMs = 33
): Promise<GestureModes> {
  const cam = await import("./camera");
  const mp = await import("./mediapipe");

  const loop = () => {
    const hands = mp.detectHands(cam.getVideoElement());
    // D5: Process ALL hands, not just hands[0]
    detector.update(hands);
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
