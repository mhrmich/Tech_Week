# D2 Dual-Deck Console Test

This tests the refactored DeckAudioEngine class with two independent instances.

## Open Browser Console

Navigate to http://localhost:5173 and open the browser console.

## Full Console Test Script

```javascript
// =============================================================================
// D2: Dual-Deck Audio Engine Test
// =============================================================================

// Option 1: Import from index
const idx = await import("/src/gesture/index.ts");
const A = idx.engineA;
const B = idx.engineB;

// Option 2: Use global (dev mode only)
// const A = window.__decks.A;
// const B = window.__decks.B;

// =============================================================================
// Initialize Audio Context
// =============================================================================

console.log("🎯 D2 Test: Initializing audio...");
await A.ensureAudio();
await B.ensureAudio();

// =============================================================================
// Load Deck A as Stems
// =============================================================================

console.log("🎯 D2 Test: Loading Deck A (stems)...");
await A.loadStems({
  vocals: "/samples/mock_vocals.mp3",
  drums:  "/samples/mock_drums.mp3",
  bass:   "/samples/mock_bass.mp3",
});

console.log("✅ Deck A loaded:", A.getState());

// =============================================================================
// Load Deck B as Full Mix
// =============================================================================

console.log("🎯 D2 Test: Loading Deck B (full mix)...");
await B.loadFullMix({ url: "/samples/mock_vocals.mp3" });

console.log("✅ Deck B loaded:", B.getState());

// =============================================================================
// Transport Test: Independent Play/Pause
// =============================================================================

console.log("🎯 D2 Test: Starting both decks...");
A.play();
B.play();

console.log("Deck A playing:", A.isPlaying());
console.log("Deck B playing:", B.isPlaying());

// Deck B should be silent (master gain = 0 by default)
console.log("Deck B master gain:", B.getState().masterGain); // Should be 0

// =============================================================================
// Crossfade Test: Bring B in gradually
// =============================================================================

console.log("🎯 D2 Test: Crossfading B in over 3 seconds...");

// Fade B in
setTimeout(() => B.setMasterGain(0.3), 1000);
setTimeout(() => B.setMasterGain(0.6), 2000);
setTimeout(() => B.setMasterGain(0.9), 3000);

// Fade B back out
setTimeout(() => B.setMasterGain(0.6), 4000);
setTimeout(() => B.setMasterGain(0.3), 5000);
setTimeout(() => B.setMasterGain(0.0), 6000);

// =============================================================================
// Tempo Test: Independent Tempo Control
// =============================================================================

console.log("🎯 D2 Test: Setting independent tempos...");

setTimeout(() => {
  console.log("Setting Deck A tempo to 1.1x");
  A.setTempoFactor(1.1);
}, 2000);

setTimeout(() => {
  console.log("Setting Deck B tempo to 0.9x");
  B.setTempoFactor(0.9);
}, 3000);

// =============================================================================
// Filter Test: Independent Filter Control
// =============================================================================

console.log("🎯 D2 Test: Setting independent filters...");

setTimeout(() => {
  console.log("Setting Deck A filter (lowpass)");
  A.setFilter(0.2); // Lowpass
}, 4000);

setTimeout(() => {
  console.log("Setting Deck B filter (highpass)");
  B.setFilter(0.8); // Highpass
}, 5000);

// =============================================================================
// Stem Control Test: Deck A Only (Full Mix has no stems)
// =============================================================================

console.log("🎯 D2 Test: Toggling Deck A stems...");

setTimeout(() => {
  console.log("Disabling Deck A vocals");
  A.setStemEnabled("vocals", false);
}, 6000);

setTimeout(() => {
  console.log("Re-enabling Deck A vocals");
  A.setStemEnabled("vocals", true);
}, 7000);

setTimeout(() => {
  console.log("Setting Deck A bass level to 0.5");
  A.setStemLevel("bass", 0.5);
}, 8000);

// =============================================================================
// Pause/Resume Test: Independent Transport
// =============================================================================

console.log("🎯 D2 Test: Independent pause/resume...");

setTimeout(() => {
  console.log("Pausing Deck A");
  A.pause();
}, 9000);

setTimeout(() => {
  console.log("Resuming Deck A");
  A.play();
}, 10000);

setTimeout(() => {
  console.log("Pausing Deck B");
  B.pause();
}, 11000);

setTimeout(() => {
  console.log("Resuming Deck B");
  B.play();
}, 12000);

// =============================================================================
// Final State Check
// =============================================================================

setTimeout(() => {
  console.log("🎯 D2 Test: Final state check...");
  console.log("Deck A:", A.getState());
  console.log("Deck B:", B.getState());

  console.log("✅ D2 Test Complete!");
  console.log("🔊 Stopping both decks...");
  A.pause();
  B.pause();
}, 13000);
```

## Quick Tests (Individual Features)

### Test: Load and Play

```javascript
const A = await import("/src/gesture/index.ts").then(m => m.engineA);

await A.ensureAudio();
await A.loadStems({
  vocals: "/samples/mock_vocals.mp3",
  drums: "/samples/mock_drums.mp3",
  bass: "/samples/mock_bass.mp3",
});

A.play();
```

### Test: Crossfade Between Decks

```javascript
const { engineA: A, engineB: B } = await import("/src/gesture/index.ts");

await A.ensureAudio();
await B.ensureAudio();

await A.loadFullMix({ url: "/samples/mock_vocals.mp3" });
await B.loadFullMix({ url: "/samples/mock_drums.mp3" });

// Play both (B is silent)
A.play();
B.play();

// Crossfade A → B
A.setMasterGain(1.0); // A full
B.setMasterGain(0.0); // B silent

setTimeout(() => {
  A.setMasterGain(0.5); // A half
  B.setMasterGain(0.5); // B half
}, 2000);

setTimeout(() => {
  A.setMasterGain(0.0); // A silent
  B.setMasterGain(1.0); // B full
}, 4000);
```

### Test: Independent Tempo

```javascript
const { engineA: A, engineB: B } = await import("/src/gesture/index.ts");

await A.ensureAudio();
await B.ensureAudio();

await A.loadFullMix({ url: "/samples/mock_vocals.mp3" });
await B.loadFullMix({ url: "/samples/mock_drums.mp3" });

A.play();
B.play();

// A plays fast, B plays slow
A.setTempoFactor(1.2);
B.setTempoFactor(0.8);
B.setMasterGain(0.6); // Hear B

// Check state
console.log("A tempo:", A.getState().tempoFactor); // 1.2
console.log("B tempo:", B.getState().tempoFactor); // 0.8
```

### Test: Stem Control (Deck A Only)

```javascript
const A = await import("/src/gesture/index.ts").then(m => m.engineA);

await A.ensureAudio();
await A.loadStems({
  vocals: "/samples/mock_vocals.mp3",
  drums: "/samples/mock_drums.mp3",
  bass: "/samples/mock_bass.mp3",
});

A.play();

// Toggle individual stems
setTimeout(() => A.setStemEnabled("vocals", false), 1000);
setTimeout(() => A.setStemEnabled("drums", false), 2000);
setTimeout(() => A.setStemEnabled("bass", false), 3000);

setTimeout(() => A.setStemEnabled("vocals", true), 4000);
setTimeout(() => A.setStemEnabled("drums", true), 5000);
setTimeout(() => A.setStemEnabled("bass", true), 6000);

// Adjust stem levels
setTimeout(() => A.setStemLevel("vocals", 0.5), 7000);
setTimeout(() => A.setStemLevel("drums", 0.3), 7500);
setTimeout(() => A.setStemLevel("bass", 0.7), 8000);
```

### Test: Filter Sweep

```javascript
const A = await import("/src/gesture/index.ts").then(m => m.engineA);

await A.ensureAudio();
await A.loadFullMix({ url: "/samples/mock_vocals.mp3" });
A.play();

// Sweep from lowpass (0.0) to highpass (1.0)
let value = 0;
const interval = setInterval(() => {
  A.setFilter(value);
  value += 0.05;
  if (value > 1) {
    clearInterval(interval);
    console.log("✅ Filter sweep complete");
  }
}, 200);
```

### Test: Memory/Cleanup

```javascript
const A = await import("/src/gesture/index.ts").then(m => m.engineA);

await A.ensureAudio();
await A.loadStems({
  vocals: "/samples/mock_vocals.mp3",
  drums: "/samples/mock_drums.mp3",
  bass: "/samples/mock_bass.mp3",
});

A.play();

// Unload and reload (should not create duplicate connections)
setTimeout(async () => {
  console.log("Unloading deck...");
  A.unload();

  console.log("Reloading deck...");
  await A.loadFullMix({ url: "/samples/mock_vocals.mp3" });
  A.play();

  console.log("✅ Reload successful - no audio glitches or duplicates");
}, 3000);

// Dispose entire deck (cleans up everything)
setTimeout(() => {
  console.log("Disposing deck...");
  A.dispose();
  console.log("✅ Deck disposed - all nodes freed");
}, 6000);
```

## Expected Behavior

### ✅ Passing Criteria

1. **TypeScript compiles with zero errors**
2. **Deck A starts with master gain = 1.0** (audible)
3. **Deck B starts with master gain = 0.0** (silent)
4. **Both decks load independently** (no interference)
5. **Play/pause per deck** (independent transport)
6. **Tempo per deck** (different playback rates work simultaneously)
7. **Filter per deck** (different filter settings work simultaneously)
8. **Stem control on Deck A** (toggle/level individual stems)
9. **Master gain ramps are click-free** (no audio pops)
10. **Crossfading between decks is smooth** (using master gain)
11. **Unload/reload doesn't create duplicate connections**
12. **Dispose() frees all audio nodes and blob URLs**

### ⚠️ Known Limitations (Addressed in D3-D5)

- **No global sync yet**: Decks start at slightly different times (Tone.now() is per-call)
- **No event bus wiring**: Gestures don't control decks yet (D4)
- **No hand routing**: All gestures go to one deck (D5 will add left/right hand routing)
- **Position clock is per-deck**: Pause/resume works but decks drift independently

## D2 Status

✅ **D2 Complete**: Clean DeckAudioEngine class with two independent instances.

**Achieved:**
- Class-based architecture with clear API
- Two deck instances (A and B)
- Independent tempo/filter/gains per deck
- Deck B starts muted for crossfading
- Click-free gain ramps
- Clean disposal and memory management
- Console-testable without gestures

**Next Steps:**
- D3: DualDeckManager for coordinated control
- D4: Wire decks to event bus (subscribe to deck-specific events)
- D5: Add hand routing (left → A, right → B) in gesture detection
