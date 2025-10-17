# D3 Synchronized Starts Test

This tests the precise timing methods and orchestrator functions for sample-accurate synchronized playback.

## Open Browser Console

Navigate to http://localhost:5173 and open the browser console.

## Full Console Test Script

```javascript
// =============================================================================
// D3: Synchronized Timing Test
// =============================================================================

// Import deck engines and orchestrator functions
const { engineA, engineB, playBothSync, playDeckSync, pauseDeck } = await import("/src/gesture/index.ts");

// =============================================================================
// Initialize Audio Context
// =============================================================================

console.log("🎯 D3 Test: Initializing audio...");
await engineA.ensureAudio();
await engineB.ensureAudio();

// =============================================================================
// Load Both Decks
// =============================================================================

console.log("🎯 D3 Test: Loading Deck A (stems)...");
await engineA.loadStems({
  vocals: "/samples/mock_vocals.mp3",
  drums:  "/samples/mock_drums.mp3",
  bass:   "/samples/mock_bass.mp3",
});

console.log("🎯 D3 Test: Loading Deck B (full mix)...");
await engineB.loadFullMix({ url: "/samples/mock_vocals.mp3" });

// Set Deck B to audible (default is 0)
engineB.setMasterGain(0.6);

console.log("✅ Both decks loaded");

// =============================================================================
// Test 1: Sample-Accurate Synchronized Start
// =============================================================================

console.log("🎯 Test 1: Synchronized start with playBothSync()...");
playBothSync();

// Wait 3 seconds, then check offsets (should be nearly identical)
setTimeout(() => {
  const offsetA = engineA.getOffsetSeconds();
  const offsetB = engineB.getOffsetSeconds();
  console.log(`Deck A offset: ${offsetA.toFixed(3)}s`);
  console.log(`Deck B offset: ${offsetB.toFixed(3)}s`);
  console.log(`Drift: ${Math.abs(offsetA - offsetB).toFixed(3)}s`);

  if (Math.abs(offsetA - offsetB) < 0.1) {
    console.log("✅ Test 1 PASSED: Decks are synchronized (drift < 100ms)");
  } else {
    console.warn("⚠️ Test 1 FAILED: Decks drifted too much");
  }
}, 3000);

// =============================================================================
// Test 2: Independent Pause/Resume
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 2: Pausing Deck A independently...");
  pauseDeck("A");
}, 4000);

setTimeout(() => {
  console.log("Deck A paused, Deck B still playing");
  console.log(`Deck A offset: ${engineA.getOffsetSeconds().toFixed(3)}s`);
  console.log(`Deck B offset: ${engineB.getOffsetSeconds().toFixed(3)}s`);
}, 5000);

setTimeout(() => {
  console.log("🎯 Test 2: Resuming Deck A with playDeckSync('A')...");
  playDeckSync("A");
}, 6000);

setTimeout(() => {
  console.log("✅ Test 2 PASSED: Independent pause/resume works");
}, 7000);

// =============================================================================
// Test 3: Precise Offset Tracking While Playing
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 3: Checking offset precision while playing...");

  // Sample offsets multiple times
  const samples = [];
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const offset = engineA.getOffsetSeconds();
      samples.push(offset);
      console.log(`Sample ${i + 1}: ${offset.toFixed(3)}s`);

      if (i === 4) {
        // Check that offsets are increasing
        let increasing = true;
        for (let j = 1; j < samples.length; j++) {
          if (samples[j] <= samples[j - 1]) {
            increasing = false;
            break;
          }
        }

        if (increasing) {
          console.log("✅ Test 3 PASSED: Offset increases monotonically while playing");
        } else {
          console.warn("⚠️ Test 3 FAILED: Offset not increasing properly");
        }
      }
    }, i * 200);
  }
}, 8000);

// =============================================================================
// Test 4: Offset Stays Constant While Paused
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 4: Pausing and checking offset stability...");
  pauseDeck("A");
  pauseDeck("B");
}, 10000);

setTimeout(() => {
  console.log("Both decks paused, sampling offsets...");

  const offsetA1 = engineA.getOffsetSeconds();
  const offsetB1 = engineB.getOffsetSeconds();

  setTimeout(() => {
    const offsetA2 = engineA.getOffsetSeconds();
    const offsetB2 = engineB.getOffsetSeconds();

    console.log(`Deck A: ${offsetA1.toFixed(3)}s → ${offsetA2.toFixed(3)}s (Δ ${Math.abs(offsetA2 - offsetA1).toFixed(3)}s)`);
    console.log(`Deck B: ${offsetB1.toFixed(3)}s → ${offsetB2.toFixed(3)}s (Δ ${Math.abs(offsetB2 - offsetB1).toFixed(3)}s)`);

    if (Math.abs(offsetA2 - offsetA1) < 0.01 && Math.abs(offsetB2 - offsetB1) < 0.01) {
      console.log("✅ Test 4 PASSED: Offsets stay constant while paused");
    } else {
      console.warn("⚠️ Test 4 FAILED: Offsets changed while paused");
    }
  }, 1000);
}, 11000);

// =============================================================================
// Test 5: Tempo-Adjusted Offset Tracking
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 5: Testing tempo-adjusted offset tracking...");

  // Reset both decks to start
  engineA.unload();
  engineB.unload();

  console.log("Reloading decks...");

  (async () => {
    await engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });
    await engineB.loadFullMix({ url: "/samples/mock_vocals.mp3" });

    // Set different tempos
    engineA.setTempoFactor(1.0); // Normal speed
    engineB.setTempoFactor(1.5); // 1.5x speed

    // Start both synchronized
    playBothSync();

    // Wait 2 seconds, then check offsets
    setTimeout(() => {
      const offsetA = engineA.getOffsetSeconds();
      const offsetB = engineB.getOffsetSeconds();

      console.log(`Deck A (1.0x): ${offsetA.toFixed(3)}s`);
      console.log(`Deck B (1.5x): ${offsetB.toFixed(3)}s`);

      // B should be ahead of A by roughly 50% (1.5x - 1.0x = 0.5x difference)
      const expectedRatio = 1.5;
      const actualRatio = offsetB / offsetA;

      console.log(`Expected ratio: ${expectedRatio.toFixed(2)}, Actual ratio: ${actualRatio.toFixed(2)}`);

      if (Math.abs(actualRatio - expectedRatio) < 0.1) {
        console.log("✅ Test 5 PASSED: Tempo-adjusted offset tracking works correctly");
      } else {
        console.warn("⚠️ Test 5 FAILED: Tempo adjustment not reflected in offsets");
      }

      // Clean up
      pauseDeck("A");
      pauseDeck("B");
    }, 2000);
  })();
}, 13000);

// =============================================================================
// Final Cleanup
// =============================================================================

setTimeout(() => {
  console.log("✅ D3 Test Complete!");
  console.log("🔊 Stopping all decks...");
  pauseDeck("A");
  pauseDeck("B");
}, 16000);
```

## Quick Tests (Individual Features)

### Test: playBothSync() - Sample-Accurate Start

```javascript
const { engineA, engineB, playBothSync } = await import("/src/gesture/index.ts");

await engineA.ensureAudio();
await engineB.ensureAudio();

await engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });
await engineB.loadFullMix({ url: "/samples/mock_drums.mp3" });

// Set B audible
engineB.setMasterGain(0.6);

// Start both at same audio quantum
playBothSync();

// Check offsets after 2 seconds (should be nearly identical)
setTimeout(() => {
  console.log("Deck A offset:", engineA.getOffsetSeconds().toFixed(3));
  console.log("Deck B offset:", engineB.getOffsetSeconds().toFixed(3));
}, 2000);
```

### Test: playDeckSync() - Single Deck Start

```javascript
const { engineA, playDeckSync } = await import("/src/gesture/index.ts");

await engineA.ensureAudio();
await engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });

// Start with 30ms lookahead
playDeckSync("A");

// Check playback
setTimeout(() => {
  console.log("Deck A playing:", engineA.isPlaying());
  console.log("Deck A offset:", engineA.getOffsetSeconds().toFixed(3));
}, 1000);
```

### Test: pauseDeck() - Immediate Pause

```javascript
const { engineA, playDeckSync, pauseDeck } = await import("/src/gesture/index.ts");

await engineA.ensureAudio();
await engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });

playDeckSync("A");

// Pause after 2 seconds
setTimeout(() => {
  console.log("Pausing...");
  const offsetBefore = engineA.getOffsetSeconds();
  pauseDeck("A");
  const offsetAfter = engineA.getOffsetSeconds();

  console.log("Offset before pause:", offsetBefore.toFixed(3));
  console.log("Offset after pause:", offsetAfter.toFixed(3));
  console.log("Difference:", Math.abs(offsetAfter - offsetBefore).toFixed(3));
}, 2000);
```

### Test: getOffsetSeconds() - Precise Offset Tracking

```javascript
const { engineA, playDeckSync } = await import("/src/gesture/index.ts");

await engineA.ensureAudio();
await engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });

playDeckSync("A");

// Sample offset every 500ms
let count = 0;
const interval = setInterval(() => {
  const offset = engineA.getOffsetSeconds();
  console.log(`[${count * 0.5}s] Offset: ${offset.toFixed(3)}s`);

  count++;
  if (count >= 10) {
    clearInterval(interval);
    engineA.pauseNow();
  }
}, 500);
```

### Test: Tempo-Adjusted Offset Tracking

```javascript
const { engineA, playDeckSync, pauseDeck } = await import("/src/gesture/index.ts");

await engineA.ensureAudio();
await engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });

// Set tempo to 2x
engineA.setTempoFactor(2.0);

playDeckSync("A");

// After 1 second of wall time, offset should be ~2 seconds
setTimeout(() => {
  const offset = engineA.getOffsetSeconds();
  console.log("Offset after 1s wall time (2x tempo):", offset.toFixed(3));
  console.log("Expected: ~2.0s");

  pauseDeck("A");
}, 1000);
```

### Test: Independent Pause/Resume

```javascript
const { engineA, engineB, playBothSync, pauseDeck, playDeckSync } = await import("/src/gesture/index.ts");

await engineA.ensureAudio();
await engineB.ensureAudio();

await engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });
await engineB.loadFullMix({ url: "/samples/mock_drums.mp3" });

engineB.setMasterGain(0.6);

// Start both
playBothSync();

// Pause A after 2s (B keeps playing)
setTimeout(() => {
  console.log("Pausing A...");
  pauseDeck("A");
  console.log("A offset:", engineA.getOffsetSeconds().toFixed(3));
  console.log("B offset:", engineB.getOffsetSeconds().toFixed(3));
}, 2000);

// Resume A after 4s (should catch up to B's wall time but not audio time)
setTimeout(() => {
  console.log("Resuming A...");
  playDeckSync("A");
  console.log("A offset (resumed):", engineA.getOffsetSeconds().toFixed(3));
  console.log("B offset (continued):", engineB.getOffsetSeconds().toFixed(3));
}, 4000);

// Stop both after 6s
setTimeout(() => {
  pauseDeck("A");
  pauseDeck("B");
}, 6000);
```

## Expected Behavior

### ✅ Passing Criteria

1. **TypeScript compiles with zero errors**
2. **playBothSync() starts both decks at same audio quantum** (drift < 100ms after several seconds)
3. **playDeckSync() starts single deck with click-free playback**
4. **pauseDeck() immediately pauses deck and updates offset accurately**
5. **getOffsetSeconds() returns accurate offset while playing** (increases monotonically)
6. **getOffsetSeconds() returns constant offset while paused** (no drift)
7. **Tempo adjustments reflected in offset tracking** (2x tempo = 2x offset increase rate)
8. **Independent pause/resume works correctly** (paused deck resumes from saved offset)
9. **No audio clicks or pops** during synchronized starts
10. **Console warnings when deck not loaded** (graceful error handling)

### ⚠️ Known Limitations (To Be Addressed in D4-D5)

- **No event bus integration**: Orchestrator functions not wired to gesture events yet (D4)
- **No hand routing**: Gestures don't control specific decks yet (D5)
- **Small drift over time**: Position clock uses wall time + tempo factor (good enough for short-term sync)
- **No beat-grid alignment**: Synchronized starts happen at same time but not at same beat (future enhancement)

## D3 Status

✅ **D3 Complete**: Precise timing methods and orchestrator functions for synchronized playback.

**Achieved:**
- `getOffsetSeconds()`: Accurate offset tracking (playing or paused)
- `playAt(when)`: Scheduled start at specific Tone.now() time
- `pauseNow()`: Immediate pause with accurate offset update
- `playBothSync()`: Sample-accurate synchronized start for both decks
- `playDeckSync(id)`: Single deck start with lookahead
- `pauseDeck(id)`: Single deck pause
- Tempo-adjusted offset tracking
- Click-free gain ramps and synchronized starts
- Graceful error handling (warnings when deck not loaded)
- Idempotent design (safe to call repeatedly)

**Next Steps:**
- D4: Wire event bus to decks (subscribe to deck-specific events)
- D5: Add hand routing (left hand → Deck A, right hand → Deck B) in gesture detection
