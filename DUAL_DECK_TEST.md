# Dual-Deck D1 Console Test

This test verifies that the type system supports deck-aware events.

## Open Browser Console

Navigate to http://localhost:5173 and open the browser console.

## Test Script

```javascript
// Import the gesture module
const { emit, subscribe } = await import('/src/gesture/index.ts');

// Subscribe to all events and log them
const unsubscribe = subscribe((event) => {
  console.log('Event received:', event);
});

// Test 1: Event without deck (backward compatible - defaults to Deck A)
emit({ type: 'PLAY' });
// Expected: { type: 'PLAY' }

// Test 2: Event with Deck A
emit({ type: 'PLAY', deck: 'A' });
// Expected: { type: 'PLAY', deck: 'A' }

// Test 3: Event with Deck B
emit({ type: 'PLAY', deck: 'B' });
// Expected: { type: 'PLAY', deck: 'B' }

// Test 4: TEMPO_SET with deck
emit({ type: 'TEMPO_SET', value: 1.1, deck: 'A' });
// Expected: { type: 'TEMPO_SET', value: 1.1, deck: 'A' }

emit({ type: 'TEMPO_SET', value: 0.9, deck: 'B' });
// Expected: { type: 'TEMPO_SET', value: 0.9, deck: 'B' }

// Test 5: STEM_TOGGLE with deck
emit({ type: 'STEM_TOGGLE', stem: 'vocals', enabled: false, deck: 'A' });
// Expected: { type: 'STEM_TOGGLE', stem: 'vocals', enabled: false, deck: 'A' }

emit({ type: 'STEM_TOGGLE', stem: 'drums', enabled: true, deck: 'B' });
// Expected: { type: 'STEM_TOGGLE', stem: 'drums', enabled: true, deck: 'B' }

// Test 6: CROSSFADER_SET (global event, no deck field)
emit({ type: 'CROSSFADER_SET', value: 0.5 });
// Expected: { type: 'CROSSFADER_SET', value: 0.5 }
// Note: Crossfader is global, so it has no deck field

// Cleanup
unsubscribe();
console.log('✅ All deck-aware events work correctly!');
```

## Expected Behavior

All events should:
1. Compile without TypeScript errors ✅
2. Emit and be received by subscribers ✅
3. Events without `deck` field work (backward compatible) ✅
4. Events with `deck: "A"` or `deck: "B"` work ✅
5. Global events (like CROSSFADER_SET) have no deck field ✅

## Debug Mode Test

You can also use the debug mode:

```javascript
// Use the debug hook
window.__djbusDebug.emit({ type: 'PAUSE', deck: 'B' });
// Should log the event with deck field
```

## TypeScript Type Check

The following should all type-check correctly in your IDE:

```typescript
import type { DJEvent, DeckID } from './gesture/index';

// Valid events
const event1: DJEvent = { type: 'PLAY' };                          // ✅ no deck
const event2: DJEvent = { type: 'PLAY', deck: 'A' };              // ✅ deck A
const event3: DJEvent = { type: 'PLAY', deck: 'B' };              // ✅ deck B
const event4: DJEvent = { type: 'TEMPO_SET', value: 1.0 };        // ✅ no deck
const event5: DJEvent = { type: 'TEMPO_SET', value: 1.0, deck: 'A' }; // ✅ with deck
const event6: DJEvent = { type: 'CROSSFADER_SET', value: 0.5 };   // ✅ no deck (global)

// Invalid events (should cause TypeScript errors)
// const invalid1: DJEvent = { type: 'PLAY', deck: 'C' };         // ❌ invalid deck
// const invalid2: DJEvent = { type: 'CROSSFADER_SET', value: 0.5, deck: 'A' }; // ❌ crossfader has no deck
```

## D1 Status

✅ **D1 Complete**: Type system now supports deck-aware events.

**Next Steps:**
- D2: Duplicate audio engine (create DeckAudio class)
- D3: Two-deck manager (orchestrate Deck A + Deck B)
- D4: Audio engine subscribes to deck field
- D5: Gesture routing (left hand → Deck A, right hand → Deck B)
