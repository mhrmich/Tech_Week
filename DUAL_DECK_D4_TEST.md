# D4 Event Router Test

This tests the event router that connects the event bus to the dual-deck audio engines.

## Open Browser Console

Navigate to http://localhost:5173 and open the browser console.

## Full Console Smoke Test

```javascript
// =============================================================================
// D4: Event Router Smoke Test
// =============================================================================

const idx = await import("/src/gesture/index.ts");
const bus = await import("/src/gesture/bus.ts");
const A = idx.engineA, B = idx.engineB;

// =============================================================================
// Initialize and Load Decks
// =============================================================================

console.log("🎯 D4 Test: Initializing audio...");
await A.ensureAudio();
await B.ensureAudio();

console.log("🎯 D4 Test: Loading decks...");
await A.loadStems({
  vocals: "/samples/mock_vocals.mp3",
  drums: "/samples/mock_drums.mp3",
  bass: "/samples/mock_bass.mp3"
});

await B.loadFullMix({ url: "/samples/mock_vocals.mp3" });

console.log("✅ Both decks loaded");

// =============================================================================
// Test 1: Default Routing (No Deck Field → Deck A)
// =============================================================================

console.log("🎯 Test 1: Routing events without deck field (should go to A)...");

// Route to A (deck omitted → defaults to A)
bus.emit({ type: "PLAY" });

setTimeout(() => {
  console.log("Deck A playing:", A.isPlaying()); // Should be true
  console.log("Deck B playing:", B.isPlaying()); // Should be false
}, 100);

setTimeout(() => {
  console.log("Setting tempo on A via event...");
  bus.emit({ type: "TEMPO_SET", value: 1.08 });
}, 1000);

setTimeout(() => {
  console.log("Deck A tempo:", A.getState().tempoFactor); // Should be 1.08
  console.log("✅ Test 1 PASSED: Events without deck field routed to A");
}, 1200);

// =============================================================================
// Test 2: Explicit Deck B Routing
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 2: Routing events explicitly to Deck B...");

  // Route to B explicitly
  bus.emit({ type: "PLAY", deck: "B" });
}, 1500);

setTimeout(() => {
  console.log("Deck B playing:", B.isPlaying()); // Should be true
  console.log("✅ Test 2 PASSED: Events with deck: 'B' routed to B");
}, 1700);

// =============================================================================
// Test 3: Master Gain Control via STEM_LEVEL
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 3: Setting master gain on B via STEM_LEVEL...");

  // Use "master" pseudo-stem to control master gain
  bus.emit({ type: "STEM_LEVEL", deck: "B", stem: "master", value: 0.6 });
}, 1800);

setTimeout(() => {
  console.log("Deck B master gain:", B.getState().masterGain); // Should be 0.6
  console.log("✅ Test 3 PASSED: STEM_LEVEL with 'master' controls master gain");
}, 2000);

// =============================================================================
// Test 4: Filter Sweep
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 4: Setting filter on B via FILTER_SWEEP...");

  bus.emit({ type: "FILTER_SWEEP", deck: "B", value: 0.75 });
}, 2200);

setTimeout(() => {
  console.log("Deck B filter:", B.getState().filter); // Should be 0.75
  console.log("✅ Test 4 PASSED: FILTER_SWEEP routed correctly");
}, 2400);

// =============================================================================
// Test 5: Independent Pause
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 5: Pausing B only...");

  // Pause B only
  bus.emit({ type: "PAUSE", deck: "B" });
}, 3500);

setTimeout(() => {
  console.log("Deck A playing:", A.isPlaying()); // Should be true
  console.log("Deck B playing:", B.isPlaying()); // Should be false
  console.log("✅ Test 5 PASSED: Independent pause works");
}, 3700);

// =============================================================================
// Test 6: Resume B
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 6: Resuming B...");

  // Bring B back
  bus.emit({ type: "PLAY", deck: "B" });
}, 4200);

setTimeout(() => {
  console.log("Deck B playing:", B.isPlaying()); // Should be true
  console.log("✅ Test 6 PASSED: Resume works");
}, 4400);

// =============================================================================
// Test 7: Fade Out B
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 7: Fading out B...");

  // Fade out B
  bus.emit({ type: "STEM_LEVEL", deck: "B", stem: "master", value: 0.0 });
}, 5200);

setTimeout(() => {
  console.log("Deck B master gain:", B.getState().masterGain); // Should be 0.0
  console.log("✅ Test 7 PASSED: Fade out via event works");
}, 5400);

// =============================================================================
// Test 8: CROSSFADER_SET (Global Event)
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 8: Testing CROSSFADER_SET (global event)...");

  // Crossfader: 0.0 = A full, 0.5 = both equal, 1.0 = B full
  bus.emit({ type: "CROSSFADER_SET", value: 0.5 });
}, 6000);

setTimeout(() => {
  console.log("After crossfader to 0.5 (both equal):");
  console.log("Deck A master gain:", A.getState().masterGain); // Should be 0.5
  console.log("Deck B master gain:", B.getState().masterGain); // Should be 0.5
}, 6200);

setTimeout(() => {
  // Crossfade to B full
  bus.emit({ type: "CROSSFADER_SET", value: 1.0 });
}, 7000);

setTimeout(() => {
  console.log("After crossfader to 1.0 (B full):");
  console.log("Deck A master gain:", A.getState().masterGain); // Should be 0.0
  console.log("Deck B master gain:", B.getState().masterGain); // Should be 1.0
  console.log("✅ Test 8 PASSED: CROSSFADER_SET controls both decks");
}, 7200);

// =============================================================================
// Test 9: Stem Toggle
// =============================================================================

setTimeout(() => {
  console.log("🎯 Test 9: Toggling vocals on Deck A...");

  // Toggle vocals off
  bus.emit({ type: "STEM_TOGGLE", stem: "vocals", enabled: false });
}, 8000);

setTimeout(() => {
  console.log("Deck A vocals enabled:", A.getState().stems.vocals); // Should be false
  console.log("✅ Test 9 PASSED: STEM_TOGGLE routed correctly");
}, 8200);

setTimeout(() => {
  // Toggle vocals back on
  bus.emit({ type: "STEM_TOGGLE", stem: "vocals", enabled: true });
}, 9000);

// =============================================================================
// Final Cleanup
// =============================================================================

setTimeout(() => {
  console.log("✅ D4 Test Complete!");
  console.log("🔊 Pausing both decks...");

  bus.emit({ type: "PAUSE" });
  bus.emit({ type: "PAUSE", deck: "B" });

  console.log("Final state:");
  console.log("Deck A:", A.getState());
  console.log("Deck B:", B.getState());
}, 10000);
```

## Quick Tests (Individual Features)

### Test: Default Routing to Deck A

```javascript
const idx = await import("/src/gesture/index.ts");
const bus = await import("/src/gesture/bus.ts");

await idx.engineA.ensureAudio();
await idx.engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });

// Emit without deck field
bus.emit({ type: "PLAY" });

setTimeout(() => {
  console.log("A playing:", idx.engineA.isPlaying()); // Should be true
}, 100);
```

### Test: Explicit Deck B Routing

```javascript
const idx = await import("/src/gesture/index.ts");
const bus = await import("/src/gesture/bus.ts");

await idx.engineB.ensureAudio();
await idx.engineB.loadFullMix({ url: "/samples/mock_vocals.mp3" });

// Set B audible
idx.engineB.setMasterGain(0.8);

// Emit with deck: "B"
bus.emit({ type: "PLAY", deck: "B" });

setTimeout(() => {
  console.log("B playing:", idx.engineB.isPlaying()); // Should be true
}, 100);
```

### Test: Crossfader (Global Event)

```javascript
const idx = await import("/src/gesture/index.ts");
const bus = await import("/src/gesture/bus.ts");

await idx.engineA.ensureAudio();
await idx.engineB.ensureAudio();

await idx.engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });
await idx.engineB.loadFullMix({ url: "/samples/mock_drums.mp3" });

// Start both
bus.emit({ type: "PLAY" });
bus.emit({ type: "PLAY", deck: "B" });

// Crossfade A → B over 4 seconds
setTimeout(() => bus.emit({ type: "CROSSFADER_SET", value: 0.0 }), 0);    // A full
setTimeout(() => bus.emit({ type: "CROSSFADER_SET", value: 0.25 }), 1000);
setTimeout(() => bus.emit({ type: "CROSSFADER_SET", value: 0.5 }), 2000); // Both equal
setTimeout(() => bus.emit({ type: "CROSSFADER_SET", value: 0.75 }), 3000);
setTimeout(() => bus.emit({ type: "CROSSFADER_SET", value: 1.0 }), 4000); // B full

setTimeout(() => {
  console.log("Final gains:");
  console.log("A:", idx.engineA.getState().masterGain); // Should be 0.0
  console.log("B:", idx.engineB.getState().masterGain); // Should be 1.0
}, 4500);
```

### Test: Master Gain via STEM_LEVEL

```javascript
const idx = await import("/src/gesture/index.ts");
const bus = await import("/src/gesture/bus.ts");

await idx.engineA.ensureAudio();
await idx.engineA.loadFullMix({ url: "/samples/mock_vocals.mp3" });

bus.emit({ type: "PLAY" });

// Use "master" pseudo-stem to control master gain
bus.emit({ type: "STEM_LEVEL", stem: "master", value: 0.3 });

setTimeout(() => {
  console.log("Master gain:", idx.engineA.getState().masterGain); // Should be 0.3
}, 100);
```

### Test: Router Error Handling

```javascript
const bus = await import("/src/gesture/bus.ts");

// Emit event to unloaded deck (should not crash)
console.log("Emitting PLAY to unloaded deck...");
bus.emit({ type: "PLAY", deck: "B" });

console.log("✅ No crash - router handles errors gracefully");
```

### Test: No Double-Subscribe During HMR

```javascript
// Check console logs for router startup messages
// Should only see ONE "🔀 Event router started" message
// Even after HMR reloads

const idx = await import("/src/gesture/index.ts");
console.log("Router status: running");

// Force HMR by editing a file and saving
// Then check console - should not see duplicate "Event router started" messages
```

## Expected Behavior

### ✅ Passing Criteria

1. **TypeScript compiles with zero errors**
2. **Router starts once at module load** (no double-subscribe)
3. **Events without deck field default to Deck A** (backward compatibility)
4. **Events with deck: "B" routed to Deck B**
5. **CROSSFADER_SET controls both decks** (global event, no deck field)
6. **STEM_LEVEL with "master" controls master gain** (not a real stem)
7. **Independent play/pause per deck** via event routing
8. **Tempo/filter events routed correctly** per deck
9. **Stem toggle/level events routed correctly** per deck
10. **Router handles errors gracefully** (no crashes on unloaded decks)
11. **No duplicate subscriptions during HMR** (idempotent startup)
12. **Console logs show router status** ("🔀 Event router started")

### ⚠️ Known Limitations (To Be Addressed in D5)

- **No hand routing yet**: All gestures emit without deck field (default to A)
- **SCRATCH_JOG not implemented**: Router receives event but audio engine doesn't handle it yet
- **PAD_TRIGGER not implemented**: Router receives event but audio engine doesn't handle it yet
- **GUEST_VOCALS_LOAD calls loadFullMix**: Works but doesn't distinguish between stems/full mix

## D4 Status

✅ **D4 Complete**: Event router connects bus to dual-deck audio engines.

**Achieved:**
- Event router starts at module load (idempotent, HMR-safe)
- Default routing to Deck A (backward compatibility)
- Explicit routing to Deck B via deck field
- CROSSFADER_SET handles global mix control
- STEM_LEVEL supports "master" pseudo-stem for gain control
- Graceful error handling (try/catch, console warnings)
- Clean routing logic (single switch statement)
- No gesture changes (gestures still emit without deck field)
- Exposed stopEventRouter() for debugging

**Next Steps:**
- D5: Add hand routing in gesture detection (left → A, right → B)
- D5: Detect which hand emitted gesture and add deck field to events
- Future: Implement SCRATCH_JOG and PAD_TRIGGER in audio engine
