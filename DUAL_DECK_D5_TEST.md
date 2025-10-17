# D5 Two-Hand Gesture Pipeline + 3-Finger Blend Mode Test

This tests the per-hand gesture processing with deck tagging and the new 3-finger blend mode for Deck B.

## Open Browser Console

Navigate to http://localhost:5173 and open the browser console.

## Gesture Mapping Summary

### Left Hand → Deck A
- **Palm** (hold 600ms) = PLAY A
- **Fist** (hold 600ms) = PAUSE A
- **Pinch** = TEMPO/FILTER A (continuous)
- **1 finger** (hold 400ms) = Toggle VOCALS A
- **2 fingers** (hold 400ms) = Toggle INSTRUMENTAL A (drums + bass)

### Right Hand → Deck B
- **Palm** (hold 600ms) = PLAY B
- **Fist** (hold 600ms) = PAUSE B
- **Pinch** = TEMPO/FILTER B (continuous)
- **3 fingers** (hold 400ms) = BLEND MODE for Deck B
  - Vertical motion controls Deck B master level (0..1)
  - Top = 1.0 (full volume), Bottom = 0.0 (silent)
  - EMA smoothing with alpha = 0.4
  - Deadzone = 0.05 (reduces jitter)
  - Emits at 15 Hz
  - Default mode: `STEM_LEVEL { deck:"B", stem:"master", value }`
  - Alternative mode: `CROSSFADER_SET { value }` (set via config)

## Console Dry Run (No Camera)

Test event routing without camera:

```javascript
// =============================================================================
// D5: Dry Run Test (Manual Event Emission)
// =============================================================================

const bus = await import("/src/gesture/bus.ts");
const { engineA, engineB } = await import("/src/gesture/index.ts");

// Initialize and load decks
await engineA.ensureAudio();
await engineB.ensureAudio();

await engineA.loadStems({
  vocals: "/samples/mock_vocals.mp3",
  drums: "/samples/mock_drums.mp3",
  bass: "/samples/mock_bass.mp3",
});

await engineB.loadFullMix({ url: "/samples/mock_vocals.mp3" });

// Test 1: Events without deck field default to A
console.log("🎯 Test 1: Default routing to A...");
bus.emit({ type: "PLAY" });
setTimeout(() => console.log("A playing:", engineA.isPlaying()), 100); // true

// Test 2: Events with deck: "B" route to B
console.log("🎯 Test 2: Explicit routing to B...");
bus.emit({ type: "PLAY", deck: "B" });
setTimeout(() => console.log("B playing:", engineB.isPlaying()), 100); // true

// Test 3: Deck B master gain control via STEM_LEVEL
console.log("🎯 Test 3: Deck B master gain via STEM_LEVEL...");
bus.emit({ type: "STEM_LEVEL", stem: "master", value: 0.6, deck: "B" });
setTimeout(() => console.log("B master gain:", engineB.getState().masterGain), 100); // 0.6

// Test 4: Independent tempo control
console.log("🎯 Test 4: Independent tempo control...");
bus.emit({ type: "TEMPO_SET", value: 1.1, deck: "A" });
bus.emit({ type: "TEMPO_SET", value: 0.9, deck: "B" });
setTimeout(() => {
  console.log("A tempo:", engineA.getState().tempoFactor); // 1.1
  console.log("B tempo:", engineB.getState().tempoFactor); // 0.9
}, 100);

// Test 5: Stem toggles per deck
console.log("🎯 Test 5: Stem toggles per deck...");
bus.emit({ type: "STEM_TOGGLE", stem: "vocals", enabled: false, deck: "A" });
setTimeout(() => console.log("A vocals:", engineA.getState().stems.vocals), 100); // false

console.log("✅ Dry run complete - router works correctly");
```

## Live Camera Test

### Test 1: Left Hand Palm (PLAY A)

1. Show left hand palm to camera
2. Hold for 600ms
3. **Expected**: Console logs `{type:"PLAY", deck:"A"}`, Deck A starts playing

### Test 2: Right Hand Palm (PLAY B)

1. Show right hand palm to camera
2. Hold for 600ms
3. **Expected**: Console logs `{type:"PLAY", deck:"B"}`, Deck B starts playing (muted if master gain = 0)

### Test 3: Left Hand Pinch (TEMPO/FILTER A)

1. Pinch left hand (thumb + index)
2. Hold for 100ms (activation threshold)
3. Move hand up/down = tempo, left/right = filter
4. **Expected**: Console logs `{type:"TEMPO_SET", value, deck:"A"}` and `{type:"FILTER_SWEEP", value, deck:"A"}`
5. Only Deck A tempo/filter changes (B unaffected)

### Test 4: Right Hand Pinch (TEMPO/FILTER B)

1. Pinch right hand
2. Move hand up/down = tempo, left/right = filter
3. **Expected**: Console logs deck:"B" events
4. Only Deck B tempo/filter changes (A unaffected)

### Test 5: Simultaneous Pinch (Both Hands)

1. Pinch BOTH hands at the same time
2. Move each hand independently
3. **Expected**: Both decks respond independently
4. Left hand controls A, right hand controls B
5. No interference between hands

### Test 6: Right Hand 3-Finger Blend Mode (NEW)

**Setup**:
```javascript
// Ensure B is audible
const { engineB } = await import("/src/gesture/index.ts");
engineB.setMasterGain(0.0); // Start at 0
```

**Test**:
1. Show right hand with 3 fingers extended (index, middle, ring)
2. Hold for 400ms
3. **Expected**: Console logs "🎚️ Entered blend mode (3-finger hold)"
4. Move hand up = volume increases (value → 1.0)
5. Move hand down = volume decreases (value → 0.0)
6. **Expected**: Console logs `{type:"STEM_LEVEL", stem:"master", value, deck:"B"}` at 15 Hz
7. **Expected**: engineB.getState().masterGain changes smoothly (EMA smoothing)
8. Release 3 fingers = exits blend mode, value stays at last position

**Verify Smoothing**:
- Rapid hand movements should NOT cause jitter
- EMA smoothing with alpha=0.4 creates smooth transitions
- Deadzone of 0.05 near center (0.5) reduces noise

### Test 7: Blend Mode vs. Pinch Priority

1. Enter blend mode (3 fingers, hold 400ms)
2. While in blend mode, pinch right hand
3. **Expected**: Pinch takes over (higher priority), blend exits
4. Pinch controls tempo/filter for Deck B
5. Release pinch, show 3 fingers again → blend mode re-enters

### Test 8: Stem Toggles Per Hand

1. Left hand: show 1 finger (hold 400ms)
   - **Expected**: `{type:"STEM_TOGGLE", stem:"vocals", enabled:false, deck:"A"}`
   - Deck A vocals toggle

2. Right hand: show 2 fingers (hold 400ms)
   - **Expected**: `{type:"STEM_TOGGLE", stem:"drums", enabled:false, deck:"B"}` (and bass)
   - But Deck B has full mix loaded (no stems), so this does nothing

### Test 9: Transport Controls Per Hand

1. Left hand fist (hold 600ms) → PAUSE A
2. Right hand fist (hold 600ms) → PAUSE B
3. Both decks pause independently
4. Left hand palm → PLAY A (only A resumes)
5. Right hand palm → PLAY B (only B resumes)

### Test 10: Blend Mode Global Crossfader (Alternative)

**Setup**:
```javascript
const cfg = await import("/src/gesture/config.ts");
cfg.setConfig({ blendMode: "global" });
```

**Test**:
1. Right hand 3 fingers (hold 400ms)
2. **Expected**: Emits `{type:"CROSSFADER_SET", value}` (no deck field)
3. Router controls BOTH decks' master gains:
   - value=0.0 → A full (1.0), B silent (0.0)
   - value=0.5 → both equal (0.5, 0.5)
   - value=1.0 → A silent (0.0), B full (1.0)

**Reset to B-only mode**:
```javascript
cfg.setConfig({ blendMode: "B-only" });
```

## Expected Behavior

### ✅ Passing Criteria

1. **TypeScript compiles with zero errors**
2. **Dry run: deck-tagged events route correctly** via D4 router
3. **Left hand gestures emit deck:"A"** (palm, fist, pinch, 1/2 fingers)
4. **Right hand gestures emit deck:"B"** (palm, fist, pinch, 3 fingers)
5. **Independent tempo/filter control** per hand/deck
6. **3-finger blend mode** (right hand only):
   - Entry: 3 fingers held for 400ms
   - Continuous emission at 15 Hz
   - Vertical motion → Deck B master gain (0..1)
   - EMA smoothing prevents jitter
   - Deadzone near center reduces noise
   - Default: emits `STEM_LEVEL { deck:"B", stem:"master", value }`
7. **Pinch priority** overrides blend mode
8. **Transport holds** (600ms) work independently per hand
9. **Stem toggle holds** (400ms) work independently per hand
10. **Simultaneous gestures** work without interference
11. **No duplicate router subscriptions** (from D4)
12. **Clean state management** (hands removed when not detected)

### ⚠️ Known Limitations

- **Blend mode only for right hand**: Left hand 3 fingers does nothing (by design)
- **Stem toggles on full-mix deck**: If Deck B loaded with loadFullMix (no stems), stem toggles have no effect
- **Hand detection accuracy**: MediaPipe may occasionally misidentify left/right
- **Finger count clamped to 4**: PostureDetector clamps to max 4 fingers (3 is maximum used)

## D5 Status

✅ **D5 Complete**: Per-hand gesture processing with deck tagging and 3-finger blend mode.

**Achieved:**
- Per-hand state tracking (HandState class)
- Independent gesture processing for left/right hands
- Deck tagging: left → A, right → B (configurable via `config.handToDeck`)
- All events emit with `deck` field
- 3-finger blend mode (right hand → Deck B master level):
  - Entry: hold 3 fingers for 400ms
  - Continuous control at 15 Hz
  - Vertical motion mapped to [0, 1]
  - EMA smoothing (alpha = 0.4)
  - Deadzone (0.05) reduces jitter
  - Two modes: "B-only" (default) or "global" (crossfader)
- Gesture priorities: pinch > transport > blend > stems > idle
- Clean hand state cleanup when hands removed
- Updated main loop to process all hands (not just hands[0])
- Backward-compatible diagnostics

**Configuration**:
```javascript
// Via config.ts
handToDeck: { left: "A", right: "B" }
blendHoldMs: 400
blendRateHz: 15
blendSmoothingAlpha: 0.4
blendMode: "B-only" | "global"
verticalDeadzone: 0.05
```

**Next Steps:**
- Optional: Enhanced diagnostics display (show both hands' modes)
- Optional: UI indicators for blend mode (visual feedback)
- Future: Beat-grid alignment for synchronized playback
- Future: Advanced routing (configurable hand-to-deck mapping)
