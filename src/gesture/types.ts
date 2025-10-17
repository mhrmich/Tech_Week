/**
 * Event types for the DJ gesture module.
 * Strict TypeScript union for all possible events that can be emitted.
 *
 * D1: Added dual-deck support via optional `deck?: DeckID` field.
 * Events with no deck specified default to Deck A (implemented in later steps).
 */

/**
 * Deck identifier for dual-deck DJ system.
 * Left hand → Deck A, Right hand → Deck B (routing in D5).
 */
export type DeckID = "A" | "B";

/**
 * Reusable stem name union.
 * Includes main track stems and guest vocals.
 */
export type StemName = "vocals" | "drums" | "bass" | "guestVocals";

/**
 * All DJ gesture events.
 * Deck-specific events include optional `deck?: DeckID` for dual-deck control.
 * Global events (like CROSSFADER_SET) apply to the mix and have no deck field.
 */
export type DJEvent =
  | { type: "PLAY"; deck?: DeckID }
  | { type: "PAUSE"; deck?: DeckID }
  | { type: "TEMPO_SET"; value: number; deck?: DeckID }        // 0.8–1.2
  | { type: "FILTER_SWEEP"; value: number; deck?: DeckID }     // 0–1
  | { type: "SCRATCH_JOG"; delta: number; deck?: DeckID }      // -1..+1 small nudges
  | { type: "PAD_TRIGGER"; pad: 1 | 2 | 3 | 4; deck?: DeckID }
  | { type: "CROSSFADER_SET"; value: number }                  // 0–1 (global, no deck)
  | { type: "STEM_TOGGLE"; stem: StemName; enabled: boolean; deck?: DeckID }
  | { type: "STEM_LEVEL"; stem: StemName; value: number; deck?: DeckID } // 0–1 continuous level control
  | { type: "GUEST_VOCALS_LOAD"; url?: string; file?: File | Blob; deck?: DeckID };
