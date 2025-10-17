/**
 * Event types for the DJ gesture module.
 * Strict TypeScript union for all possible events that can be emitted.
 */

/**
 * Reusable stem name union.
 * Includes main track stems and guest vocals.
 */
export type StemName = "vocals" | "drums" | "bass" | "guestVocals";

export type DJEvent =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "TEMPO_SET"; value: number }        // 0.8–1.2
  | { type: "FILTER_SWEEP"; value: number }     // 0–1
  | { type: "SCRATCH_JOG"; delta: number }      // -1..+1 small nudges
  | { type: "PAD_TRIGGER"; pad: 1 | 2 | 3 | 4 }
  | { type: "CROSSFADER_SET"; value: number }   // 0–1
  | { type: "STEM_TOGGLE"; stem: StemName; enabled: boolean }
  | { type: "STEM_LEVEL"; stem: StemName; value: number } // 0–1 continuous level control
  | { type: "GUEST_VOCALS_LOAD"; url?: string; file?: File | Blob };
