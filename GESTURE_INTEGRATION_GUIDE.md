# Gesture Control Integration Guide

## Overview

This guide explains how to integrate the hand gesture recognition system with your existing audio UI controls. The gesture system is **completely decoupled** from the UI using an event bus pattern, making integration straightforward.

**Your audio UI controls stay unchanged.** You simply subscribe to gesture events and map them to your existing audio control functions.

---

## Architecture Summary

```
Hand Camera → MediaPipe → Gesture Detection → Event Bus → Your Audio Controls
                                                    ↓
                                            Your UI Updates
```

**Key Concepts:**
- **Event Bus**: All gesture events are published to a central bus (`src/gesture/bus.ts`)
- **Decoupled**: Gesture system has no knowledge of your UI
- **Subscribe Pattern**: Your code subscribes to events and calls your existing functions

---

## Quick Start Integration

### Step 1: Import the Gesture Module

```typescript
import {
  startGestureModule,
  subscribe,
  type DJEvent
} from './gesture/index';
```

### Step 2: Start the Gesture System

```typescript
// Start gesture recognition (requires user gesture like button click)
async function initializeGestures() {
  try {
    await startGestureModule({
      modelUrl: '/models/hand_landmarker.task' // default path
    });
    console.log('✅ Gesture system ready');
  } catch (error) {
    console.error('❌ Failed to start gestures:', error);
  }
}

// Call this from a user interaction (e.g., "Start" button click)
startButton.addEventListener('click', initializeGestures);
```

### Step 3: Subscribe to Gesture Events

```typescript
// Subscribe to all gesture events
subscribe((event: DJEvent) => {
  switch (event.type) {
    case 'PLAY':
      yourAudioPlayer.play(); // Call your existing play function
      updatePlayButton(true); // Update your UI
      break;

    case 'PAUSE':
      yourAudioPlayer.pause(); // Call your existing pause function
      updatePlayButton(false); // Update your UI
      break;

    case 'TEMPO_SET':
      yourAudioPlayer.setTempo(event.value); // event.value is 0.8–1.2
      updateTempoSlider(event.value); // Update your UI
      break;

    case 'FILTER_SWEEP':
      yourAudioPlayer.setFilter(event.value); // event.value is 0–1
      updateFilterKnob(event.value); // Update your UI
      break;

    case 'STEM_TOGGLE':
      yourAudioPlayer.toggleStem(event.stem, event.enabled);
      updateStemButton(event.stem, event.enabled); // Update your UI
      break;

    case 'STEM_LEVEL':
      yourAudioPlayer.setStemLevel(event.stem, event.value);
      updateStemFader(event.stem, event.value); // Update your UI
      break;

    case 'GUEST_VOCALS_LOAD':
      yourAudioPlayer.loadGuestVocals(event.url || event.file);
      showGuestLoadedIndicator(true); // Update your UI
      break;
  }
});
```

---

## Event Reference

### Transport Controls

#### `PLAY`
- **Gesture**: Open palm (4 fingers) held for 600ms
- **Purpose**: Start playback
- **Event**: `{ type: "PLAY" }`

#### `PAUSE`
- **Gesture**: Fist (closed hand) held for 600ms
- **Purpose**: Pause playback
- **Event**: `{ type: "PAUSE" }`

**Cooldown**: 2 seconds between transport events (prevents accidental double-triggers)

---

### Continuous Controls

#### `TEMPO_SET`
- **Gesture**: Pinch (thumb + index finger) + vertical motion
- **Purpose**: Adjust playback tempo
- **Event**: `{ type: "TEMPO_SET", value: number }` (0.8–1.2)
- **Mapping**:
  - Hand at top of frame → value = 1.2 (faster)
  - Hand at center → value = 1.0 (normal)
  - Hand at bottom → value = 0.8 (slower)
- **Rate**: 15 Hz (configurable)

#### `FILTER_SWEEP`
- **Gesture**: Pinch + horizontal motion
- **Purpose**: Sweep audio filter (lowpass ↔ highpass)
- **Event**: `{ type: "FILTER_SWEEP", value: number }` (0–1)
- **Mapping**:
  - Hand at left → value = 0 (lowpass 400Hz)
  - Hand at center → value = 0.5 (neutral 8000Hz)
  - Hand at right → value = 1 (highpass 3000Hz)
- **Rate**: 15 Hz (configurable)

**Note**: Pinch requires 100ms hold before activating (prevents false triggers)

---

### Stem Controls

#### `STEM_TOGGLE`
- **Gesture 1**: 1 finger up, held for 400ms → Toggle vocals on/off
- **Gesture 2**: 2 fingers up, held for 400ms → Toggle instrumental (drums + bass) on/off
- **Purpose**: Mute/unmute individual stems
- **Event**: `{ type: "STEM_TOGGLE", stem: StemName, enabled: boolean }`
- **Stems**: `"vocals" | "drums" | "bass" | "guestVocals"`
- **Behavior**: One-shot toggle (must release and re-hold to toggle again)

#### `STEM_LEVEL`
- **Gesture**: (Reserved for GV4 - 3-finger gesture for guest vocals level)
- **Purpose**: Set stem volume level
- **Event**: `{ type: "STEM_LEVEL", stem: StemName, value: number }` (0–1)

---

### Guest Vocals (Multi-Track Support)

#### `GUEST_VOCALS_LOAD`
- **Purpose**: Load a second vocal track (e.g., guest artist, freestyle track)
- **Event**: `{ type: "GUEST_VOCALS_LOAD", url?: string, file?: File | Blob }`
- **Usage**: Currently triggered via your UI file upload, gesture control coming in GV4

**BPM Tempo Matching**:
```typescript
import { setMasterBpm, setGuestBpm, getBpms } from './gesture/index';

// Set BPMs for automatic tempo matching
setMasterBpm(128); // Your main track's BPM
setGuestBpm(96);   // Guest track's BPM

// Guest will automatically play at adjusted rate to match master tempo
// Example: master=128, guest=96 → guest plays at 1.333x speed
```

---

## Integration Patterns

### Pattern 1: Direct Mapping (Simplest)

If your audio controls already exist as functions, just call them directly:

```typescript
subscribe((event) => {
  if (event.type === 'PLAY') myPlayer.play();
  if (event.type === 'PAUSE') myPlayer.pause();
  if (event.type === 'TEMPO_SET') myPlayer.setPlaybackRate(event.value);
  // ... etc
});
```

### Pattern 2: UI State Sync

Keep your UI in sync with gesture events:

```typescript
subscribe((event) => {
  switch (event.type) {
    case 'TEMPO_SET':
      // Update your audio
      myPlayer.setTempo(event.value);

      // Update your UI slider
      tempoSlider.value = event.value;
      tempoLabel.textContent = `${(event.value * 100).toFixed(0)}%`;
      break;
  }
});
```

### Pattern 3: Bidirectional Control

Allow both gesture AND UI controls to work together:

```typescript
// Gesture → Audio
subscribe((event) => {
  if (event.type === 'TEMPO_SET') {
    setTempo(event.value); // Shared function
  }
});

// UI Slider → Audio
tempoSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  setTempo(value); // Same shared function
});

// Shared function updates both audio and UI
function setTempo(value: number) {
  myPlayer.setTempo(value);
  tempoSlider.value = value;
  tempoLabel.textContent = `${(value * 100).toFixed(0)}%`;
}
```

### Pattern 4: Event Filtering

Only subscribe to specific events you care about:

```typescript
subscribe((event) => {
  // Only handle transport controls, ignore others
  if (event.type === 'PLAY' || event.type === 'PAUSE') {
    handleTransport(event);
  }
});
```

---

## Configuration

Gesture behavior can be tuned via `src/gesture/config.ts`:

```typescript
import { setConfig } from './gesture/index';

setConfig({
  // Transport hold durations
  transportHoldMs: 600,      // How long to hold palm/fist
  transportCooldownMs: 2000, // Cooldown between PLAY/PAUSE

  // Stem toggle settings
  stemToggleHoldMs: 400,     // How long to hold finger gesture

  // Continuous control rate
  continuousHz: 15,          // Events per second for tempo/filter

  // Pinch activation
  pinchActivationMs: 100,    // Delay before pinch activates

  // Tempo/filter ranges
  tempoMin: 0.8,
  tempoMax: 1.2,
  filterMin: 0.0,
  filterMax: 1.0,

  // Video resolution (affects gesture detection area)
  videoWidth: 640,
  videoHeight: 480,
});
```

---

## Audio Engine Integration (Optional)

If you don't have audio controls yet, you can use the built-in audio engine:

```typescript
import {
  initAudio,
  loadStems,
  subscribe
} from './gesture/index';

// Initialize audio (requires user gesture)
await initAudio();

// Load your audio stems
await loadStems({
  vocals: '/audio/vocals.mp3',
  drums: '/audio/drums.mp3',
  bass: '/audio/bass.mp3'
});

// Audio engine automatically responds to gesture events
// No need to subscribe - it's already connected!

// Optional: Load guest vocals
import { loadGuestVocals, setMasterBpm, setGuestBpm } from './gesture/index';

await loadGuestVocals({ url: '/audio/guest.mp3' });
setMasterBpm(128);
setGuestBpm(96); // Auto tempo-matches to master
```

**Note**: The built-in audio engine already subscribes to the event bus. If you use it, gesture events are automatically handled.

---

## Camera & Permissions

### Camera Access

The gesture system needs camera access:

```typescript
// Camera automatically starts when you call startGestureModule()
await startGestureModule();

// The system will request camera permission if not already granted
```

### Showing Camera Feed (Optional)

If you want to show the camera feed in your UI:

```typescript
import { getVideoElement } from './gesture/camera';

// Get the video element
const video = getVideoElement();

// Append to your UI
document.getElementById('camera-container').appendChild(video);

// Style it
video.style.width = '320px';
video.style.height = '240px';
video.style.transform = 'scaleX(-1)'; // Mirror for better UX
```

---

## Diagnostics & Debugging

### Enable Console Diagnostics

```typescript
// In browser console or your code:
__gestureDiag.enable(true);

// You'll see periodic logs like:
// diag | fps: 59.8 | dropped: 0 | mode: pinch2D | bpm M:128 G:96 | events: 5 play / 12 tempo_set
```

### Check Current State

```typescript
// Check if gesture system is running
import { isGestureModuleRunning } from './gesture/index';
console.log('Gestures active?', isGestureModuleRunning());

// Check BPM settings
import { getBpms } from './gesture/index';
console.log('BPMs:', getBpms()); // { master: 128, guest: 96 }

// Check stem states
import { getStemStates } from './gesture/index';
console.log('Stems:', getStemStates()); // { vocals: true, drums: true, bass: false }
```

### Event Monitoring

```typescript
// Log all events to console
import { subscribe } from './gesture/index';

subscribe((event) => {
  console.log('Gesture event:', event);
});
```

---

## Example: Complete Integration

Here's a full example integrating with a hypothetical audio UI:

```typescript
import {
  startGestureModule,
  subscribe,
  type DJEvent,
  initAudio,
  loadStems
} from './gesture/index';

// Your existing audio player (example)
class MyAudioPlayer {
  play() { /* your code */ }
  pause() { /* your code */ }
  setTempo(value: number) { /* your code */ }
  setFilter(value: number) { /* your code */ }
  toggleStem(stem: string, enabled: boolean) { /* your code */ }
}

const player = new MyAudioPlayer();

// Initialize gesture system
document.getElementById('start-btn')?.addEventListener('click', async () => {
  try {
    // Start gesture recognition
    await startGestureModule();

    // Optional: Use built-in audio engine
    await initAudio();
    await loadStems({
      vocals: '/audio/vocals.mp3',
      drums: '/audio/drums.mp3',
      bass: '/audio/bass.mp3'
    });

    console.log('✅ System ready!');
  } catch (error) {
    console.error('❌ Initialization failed:', error);
  }
});

// Subscribe to gesture events
subscribe((event: DJEvent) => {
  switch (event.type) {
    case 'PLAY':
      player.play();
      updateUI('playing', true);
      break;

    case 'PAUSE':
      player.pause();
      updateUI('playing', false);
      break;

    case 'TEMPO_SET':
      player.setTempo(event.value);
      updateUI('tempo', event.value);
      break;

    case 'FILTER_SWEEP':
      player.setFilter(event.value);
      updateUI('filter', event.value);
      break;

    case 'STEM_TOGGLE':
      player.toggleStem(event.stem, event.enabled);
      updateUI(`stem-${event.stem}`, event.enabled);
      break;
  }
});

// Your UI update function
function updateUI(control: string, value: any) {
  // Update your UI elements here
  console.log(`UI update: ${control} = ${value}`);
}
```

---

## TypeScript Types

All event types are strictly typed:

```typescript
import type { DJEvent, StemName } from './gesture/index';

// DJEvent is a discriminated union:
type DJEvent =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "TEMPO_SET"; value: number }
  | { type: "FILTER_SWEEP"; value: number }
  | { type: "STEM_TOGGLE"; stem: StemName; enabled: boolean }
  | { type: "STEM_LEVEL"; stem: StemName; value: number }
  | { type: "GUEST_VOCALS_LOAD"; url?: string; file?: File | Blob }
  | { type: "PAD_TRIGGER"; pad: 1 | 2 | 3 | 4 }
  | { type: "CROSSFADER_SET"; value: number }
  | { type: "SCRATCH_JOG"; delta: number };

type StemName = "vocals" | "drums" | "bass" | "guestVocals";
```

TypeScript will provide autocomplete and type safety for all events.

---

## Performance Notes

- **FPS**: Gesture detection runs at ~60 FPS
- **Latency**: ~16ms from hand motion to event emission
- **CPU Usage**: ~5-10% on modern hardware (MediaPipe is optimized)
- **Event Rate**: Continuous events (tempo/filter) are rate-limited to 15 Hz by default

---

## Troubleshooting

### Camera not starting
- Check browser console for permission errors
- Ensure HTTPS (or localhost) - camera requires secure context
- Try calling `startGestureModule()` from a user interaction (button click)

### Events not firing
- Check `isGestureModuleRunning()` returns `true`
- Enable diagnostics: `__gestureDiag.enable(true)`
- Verify hand is visible in camera frame and well-lit

### Gestures triggering too easily
- Increase hold durations in config (e.g., `transportHoldMs: 800`)
- Increase cooldown periods (e.g., `transportCooldownMs: 3000`)

### Gestures not triggering
- Decrease hold durations (e.g., `transportHoldMs: 400`)
- Check hand is centered in frame and fingers are clearly visible
- Ensure good lighting

---

## Roadmap

**Current Features (GV1-GV3):**
- ✅ Palm/fist transport controls (PLAY/PAUSE)
- ✅ Pinch 2D controls (tempo + filter)
- ✅ 1/2 finger stem toggles (vocals, instrumental)
- ✅ Guest vocals loading and BPM tempo matching

**Coming Soon (GV4):**
- 🚧 3-finger gesture for guest vocals (toggle + level fade)

---

## Questions?

If you need help integrating:
1. Check the examples in this guide
2. Look at `src/gesture/audioEngine.ts` for a reference implementation
3. Enable diagnostics to see what events are firing
4. Check browser console for errors

**Key Files:**
- `src/gesture/index.ts` - Main entry point
- `src/gesture/bus.ts` - Event bus
- `src/gesture/types.ts` - Event type definitions
- `src/gesture/audioEngine.ts` - Reference audio implementation

---

## Summary Checklist

- [ ] Import `startGestureModule` and `subscribe`
- [ ] Call `startGestureModule()` on user interaction
- [ ] Subscribe to events with `subscribe((event) => { ... })`
- [ ] Map events to your existing audio control functions
- [ ] Update your UI in response to events
- [ ] Test with camera enabled
- [ ] (Optional) Enable diagnostics for debugging

**That's it!** The gesture system is designed to drop into your existing codebase with minimal changes.
