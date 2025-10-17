/**
 * Event types for the DJ gesture module.
 * Strict TypeScript union for all possible events that can be emitted.
 */

export type DJEvent =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "TEMPO_SET"; value: number }        // 0.8–1.2
  | { type: "FILTER_SWEEP"; value: number }     // 0–1
  | { type: "SCRATCH_JOG"; delta: number }      // -1..+1 small nudges
  | { type: "PAD_TRIGGER"; pad: 1 | 2 | 3 | 4 }
  | { type: "CROSSFADER_SET"; value: number }   // 0–1
  | { type: "STEM_TOGGLE"; stem: "vocals" | "drums" | "bass"; enabled: boolean };
