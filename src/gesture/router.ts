/**
 * D4: Event router - connects event bus to dual-deck audio engines.
 * Subscribes once to the bus and forwards events to the correct deck.
 * Defaults to Deck A for backward compatibility.
 */

import { subscribe } from "./bus";
import { engineA, engineB } from "./audioEngine";
import type { DJEvent, DeckID } from "./types";

let _unsub: null | (() => void) = null;

/**
 * Pick the correct deck based on optional deck field.
 * Defaults to Deck A for backward compatibility.
 */
function pick(deck?: DeckID) {
  return deck === "B" ? engineB : engineA;
}

/**
 * Start the event router.
 * Subscribes once to the bus and routes events to deck engines.
 * Returns unsubscribe function.
 * Idempotent: safe to call multiple times (guards against HMR double-subscribe).
 */
export function startEventRouter(): () => void {
  // Guard against double-subscribe during HMR
  if (_unsub) {
    console.log("🔀 Event router already running");
    return _unsub;
  }

  _unsub = subscribe((e: DJEvent) => {
    try {
      // Handle global events (no deck field)
      if (e.type === "CROSSFADER_SET") {
        // Crossfader: 0.0 = A full, 0.5 = both equal, 1.0 = B full
        const v = e.value;
        const gainA = Math.max(0, Math.min(1, 1 - v)); // 1.0 → 0.0 as v goes 0→1
        const gainB = Math.max(0, Math.min(1, v));     // 0.0 → 1.0 as v goes 0→1

        engineA.setMasterGain(gainA, 0.03);
        engineB.setMasterGain(gainB, 0.03);
        return; // Don't route to specific deck
      }

      // Handle deck-specific events
      const eng = pick((e as any).deck);

      switch (e.type) {
        case "PLAY":
          eng.play();
          break;

        case "PAUSE":
          eng.pause();
          break;

        case "TEMPO_SET":
          eng.setTempoFactor(e.value);
          break;

        case "FILTER_SWEEP":
          eng.setFilter(e.value);
          break;

        case "STEM_TOGGLE": {
          const stem = e.stem as any;
          eng.setStemEnabled(stem, e.enabled);
          break;
        }

        case "STEM_LEVEL": {
          const stem = e.stem as any;
          // Special case: "master" pseudo-stem maps to master gain
          if (stem === "master") {
            eng.setMasterGain(e.value);
          } else {
            eng.setStemLevel(stem, e.value);
          }
          break;
        }

        case "GUEST_VOCALS_LOAD":
          eng.loadFullMix({ url: e.url, file: e.file });
          break;

        case "SCRATCH_JOG":
          // Not implemented in audio engine yet (future: pitch bend or scrub)
          // console.debug("router: SCRATCH_JOG not implemented", e);
          break;

        case "PAD_TRIGGER":
          // Not implemented in audio engine yet (future: cue points, samples)
          // console.debug("router: PAD_TRIGGER not implemented", e);
          break;

        default:
          // Unhandled event type (breadcrumb for development)
          // console.debug("router: unhandled event", e);
          break;
      }
    } catch (err) {
      console.warn("⚠️ Event router error:", err);
    }
  });

  console.log("🔀 Event router started");
  return _unsub;
}

/**
 * Stop the event router.
 * Unsubscribes from the bus.
 */
export function stopEventRouter(): void {
  if (_unsub) {
    _unsub();
    _unsub = null;
    console.log("🔀 Event router stopped");
  }
}
