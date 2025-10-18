# DJ Vision - Gesture-Controlled Dual-Deck DJ System

A revolutionary DJ control system that uses hand gestures and computer vision to control dual audio decks in real-time, eliminating the need for traditional physical equipment.

## Team Members

- Sam Doane
- Matthew Hrmich

## Project Overview

### Problem

Traditional DJ equipment is expensive, bulky, and requires physical contact with hardware. Learning to DJ requires investing hundreds or thousands of dollars in mixers, controllers, and decks. Remote DJing and collaborative performances are limited by physical equipment constraints.

### Solution

DJ Vision transforms any computer with a webcam into a professional dual-deck DJ system. Using MediaPipe hand tracking and gesture recognition, users can:

- **Control two independent audio decks** with left and right hands
- **Play/pause tracks** with palm and fist gestures
- **Adjust tempo (0.8x - 1.2x)** with pinch gestures and vertical hand movement
- **Apply filter sweeps** (lowpass/highpass) with horizontal hand movement
- **Toggle vocal and instrumental stems** with 1 and 2 finger gestures
- **Crossfade between decks** with 3-finger vertical gestures
- **Real-time visual feedback** with synchronized UI sliders and meters

### How AI is Used

#### 1. **Computer Vision with MediaPipe**
- **Hand Landmarker Model**: Detects 21 landmarks on each hand in real-time (30+ FPS)
- **Multi-hand tracking**: Processes both hands simultaneously for independent deck control
- **Pose classification**: Identifies specific hand postures (palm, fist, pinch, finger counts)
- **Gesture recognition**: Converts hand positions into DJ control commands

#### 2. **Real-Time Gesture Processing**
- **State machines**: Intelligent gesture mode detection with priority hierarchies
- **Temporal smoothing**: EMA (Exponential Moving Average) filtering for stable control
- **Cooldown systems**: Prevents unintended triggering and gesture conflicts
- **Event-driven architecture**: Decoupled gesture detection from audio processing

#### 3. **Audio Processing with Web Audio API**
- **Multi-stem playback**: Independent control of vocals, drums, and bass
- **Real-time effects**: Dynamic filters, tempo control, and gain adjustment
- **Synchronized timing**: Maintains beat sync across both decks
- **Low-latency processing**: Sub-30ms response time from gesture to audio

#### 4. **Intelligent Control Mapping**
- **Mirrored hand control**: Right hand → Deck A, Left hand → Deck B (camera-compensated)
- **Adaptive thresholds**: Hold duration requirements prevent accidental triggers
- **Contextual gesture modes**: Same hand positions trigger different actions based on context
- **Visual feedback loop**: UI updates synchronize with gesture state for intuitive control

## Tech Stack

- **React + TypeScript + Vite**: Modern web framework with fast HMR
- **MediaPipe Hand Landmarker**: Google's ML model for hand tracking
- **Tone.js**: Web Audio API framework for audio synthesis and processing
- **Tailwind CSS + shadcn/ui**: Modern, responsive UI components
- **Event-driven architecture**: Decoupled modules with message bus pattern

## Features

### Gesture Controls

| Gesture | Duration | Action |
|---------|----------|--------|
| **Palm (hold)** | 600ms | Play track |
| **Fist (hold)** | 600ms | Pause track |
| **Pinch + Vertical** | 100ms activation | Adjust tempo (0.8x - 1.2x) |
| **Pinch + Horizontal** | 100ms activation | Filter sweep (lowpass ↔ highpass) |
| **1 Finger (hold)** | 400ms | Toggle vocals on/off |
| **2 Fingers (hold)** | 400ms | Toggle instrumental on/off |
| **3 Fingers (hold + vertical)** | 400ms | Crossfade between decks |

### Audio Features

- **Dual-deck architecture**: Independent Tone.js engines for Deck A and B
- **Multi-stem support**: Separate control of vocals, drums, and bass
- **Synchronized tempo**: Tempo changes apply to both decks simultaneously
- **Real-time filtering**: Lowpass (400-8000Hz) and highpass (150-3000Hz) with smooth ramping
- **Master controls**: Global crossfader and master volume
- **VU meters**: Real-time peak and RMS level monitoring

### UI Features

- **Real-time waveform display**: Visual representation of loaded tracks
- **Synchronized sliders**: Filter and tempo controls reflect gesture input
- **Deck-specific color coding**: Deck A (green) and Deck B (blue) for easy identification
- **Crossfader percentage display**: Large, prominent percentage with deck bias indicator
- **Responsive layout**: Works on various screen sizes
- **Dark mode optimized**: Professional DJ aesthetic

## Installation & Setup

### Prerequisites

```bash
Node.js 18+ and npm
Webcam for gesture control
Audio files (MP3, WAV) split into stems (vocals + instrumental)
```

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

Open `http://localhost:5173` in your browser (Chrome recommended for best Web Audio support).

### Build for Production

```bash
npm run build
```

## Usage

1. **Allow camera access** when prompted
2. **Upload stems** for each deck:
   - Deck A: Upload vocal file + instrumental file
   - Deck B: Upload vocal file + instrumental file
3. **Position hands** in front of camera (mirrored view)
4. **Perform gestures** to control playback:
   - Right hand controls Deck A
   - Left hand controls Deck B
5. **Watch UI feedback** as sliders and meters respond to gestures
6. **Mix tracks** using crossfade and stem toggles

## Project Structure

```
src/
├── components/          # React UI components
│   ├── deck.tsx        # Individual deck UI with controls
│   ├── library.tsx     # Stem upload interface
│   ├── master-bar.tsx  # Crossfader and master controls
│   └── ui/             # Reusable UI components (shadcn)
├── gesture/            # Gesture detection and processing
│   ├── audioEngine.ts  # Tone.js dual-deck audio engine
│   ├── camera.ts       # Webcam access and video processing
│   ├── mediapipe.ts    # MediaPipe Hand Landmarker integration
│   ├── modes.ts        # Gesture state machines and mode detection
│   ├── posture.ts      # Hand posture classification
│   ├── router.ts       # Event routing to audio engines
│   ├── bus.ts          # Event bus for decoupled communication
│   └── config.ts       # Configuration constants
├── lib/                # Utilities and adapters
│   ├── audio-adapter.ts # Bridge between UI and Tone.js engines
│   └── audio-context.ts # Web Audio context management
└── App.tsx             # Main application component
```

## Architecture Highlights

### Event-Driven Design

```
Webcam → MediaPipe → Posture Detection → Gesture Modes → Event Bus
                                                              ↓
                                                          Router
                                                              ↓
                                         ┌──────────────┬────────────────┐
                                         ↓              ↓                ↓
                                      Engine A      Engine B      UI Updates
```

### Gesture Priority System

1. **Pinch2D** (highest) - blocks all other gestures
2. **Transport** (palm/fist) - blocks stems and blend
3. **Blend** (3 fingers) - blocks stems
4. **Stems** (1-2 fingers) - lowest priority
5. **Idle** - resets all state

### Audio Signal Flow

```
Stems (vocals, drums, bass)
    ↓
Individual Gain Controls
    ↓
Stem Mix Bus
    ↓
Bandpass Filter (gesture-controlled)
    ↓
Master Gain (deck volume)
    ↓
Limiter (-1dB)
    ↓
Destination (speakers)
```

## Performance

- **Gesture detection**: 30+ FPS (limited by MediaPipe model)
- **Audio latency**: <30ms from gesture to sound change
- **Event processing**: 15-30 Hz for continuous controls (tempo, filter)
- **State polling**: 100ms for UI synchronization
- **Memory**: ~200MB for dual-deck with loaded stems

## Future Enhancements

- [ ] BPM detection and automatic beat matching
- [ ] Looping and cue points
- [ ] Effects rack (reverb, delay, phaser)
- [ ] Recording and export functionality
- [ ] MIDI controller integration
- [ ] Multi-user collaborative mixing
- [ ] AI-powered track suggestions

## License

MIT

## Acknowledgments

- **MediaPipe** by Google for hand tracking ML models
- **Tone.js** for Web Audio framework
- **shadcn/ui** for beautiful React components
- **Claude AI** (Anthropic) for development assistance and architecture guidance

---

Built during Tech Week Hackathon 2025
