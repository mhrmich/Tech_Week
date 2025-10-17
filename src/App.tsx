import React from "react"
import { useState, useEffect, useRef } from "react"
import { Library } from "./components/library"
import { Deck } from "./components/deck"
import { MasterBar } from "./components/master-bar"
import type { AudioTrack, DeckId } from "./lib/types"
import { getAudioEngine } from "./lib/audio-context"
import { startGestureModule, stopGestureModule, subscribe, type DJEvent } from "./gesture/index"
import * as camera from "./gesture/camera"

export default function App() {
  const [tracks, setTracks] = useState<AudioTrack[]>([])
  const [deckATracks, setDeckATracks] = useState<AudioTrack | null>(null)
  const [deckBTracks, setDeckBTracks] = useState<AudioTrack | null>(null)
  const [focusedDeck, setFocusedDeck] = useState<DeckId>("A")
  const [crossfader, setCrossfader] = useState(0.5)
  const [masterVolume, setMasterVolume] = useState(0.8)
  const [audioEngine, setAudioEngine] = useState<any>(null)

  // Gesture control state
  const [gesturesEnabled, setGesturesEnabled] = useState(false)
  const [cameraStarted, setCameraStarted] = useState(false)
  const [lastGestureEvent, setLastGestureEvent] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const videoContainerRef = useRef<HTMLDivElement>(null)
  const videoElementRef = useRef<HTMLVideoElement | null>(null)

  const deckARef = useRef<{
    handlePlayPause: () => void
    handleSeekBackward: (amount?: number) => void
    handleSeekForward: (amount?: number) => void
    handleVolumeUp: () => void
    handleVolumeDown: () => void
    handleLowCutStep: (delta: number) => void
    handleHighCutStep: (delta: number) => void
    handleBandReset: () => void
    handlePlaybackRateStep: (delta: number) => void
    handlePitchLockToggle: () => void
  } | null>(null)

  const deckBRef = useRef<{
    handlePlayPause: () => void
    handleSeekBackward: (amount?: number) => void
    handleSeekForward: (amount?: number) => void
    handleVolumeUp: () => void
    handleVolumeDown: () => void
    handleLowCutStep: (delta: number) => void
    handleHighCutStep: (delta: number) => void
    handleBandReset: () => void
    handlePlaybackRateStep: (delta: number) => void
    handlePitchLockToggle: () => void
  } | null>(null)

  // Initialize audio engine
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAudioEngine(getAudioEngine())
    }
  }, [])

  useEffect(() => {
    if (audioEngine) {
      audioEngine.setCrossfader(crossfader)
    }
  }, [crossfader, audioEngine])

  useEffect(() => {
    if (audioEngine) {
      audioEngine.setMasterVolume(masterVolume)
    }
  }, [masterVolume, audioEngine])

  const handleTrackSelect = (track: AudioTrack) => {
    if (focusedDeck === "A") {
      setDeckATracks(track)
    } else {
      setDeckBTracks(track)
    }
  }

  // Start gesture recognition
  const handleStartGestures = async () => {
    setErrorMessage("")
    try {
      console.log('Starting gesture module...')

      // Resume audio context on user gesture (required by browser autoplay policy)
      if (audioEngine) {
        const ctx = (audioEngine as any).context
        if (ctx && ctx.state === 'suspended') {
          await ctx.resume()
          console.log('✅ Audio context resumed')
        }
      }

      // First set camera started to trigger React re-render
      setCameraStarted(true)

      await startGestureModule({ modelUrl: '/models/hand_landmarker.task' })

      // Get the camera video element and insert it after React has rendered
      setTimeout(() => {
        const cameraVideo = camera.getVideoElement()
        videoElementRef.current = cameraVideo

        if (videoContainerRef.current && cameraVideo) {
          // Style and add camera video (React has already cleared the placeholder)
          cameraVideo.className = 'w-full h-full object-cover rounded-lg'
          cameraVideo.style.transform = 'scaleX(-1)' // Mirror for better UX
          videoContainerRef.current.appendChild(cameraVideo)
        }
      }, 0)

      console.log('✅ Gesture module started')
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('Failed to start gestures:', error)
      setErrorMessage(`Camera error: ${errorMsg}`)
      setCameraStarted(false)
    }
  }

  // Stop gesture recognition
  const handleStopGestures = () => {
    try {
      stopGestureModule()

      // Remove video element if it exists
      if (videoElementRef.current && videoContainerRef.current) {
        try {
          if (videoContainerRef.current.contains(videoElementRef.current)) {
            videoContainerRef.current.removeChild(videoElementRef.current)
          }
        } catch (e) {
          console.warn('Video element already removed:', e)
        }
      }
      videoElementRef.current = null

      setCameraStarted(false)
      setGesturesEnabled(false)
      setLastGestureEvent("")
      setErrorMessage("")
    } catch (error) {
      console.error('Error stopping gestures:', error)
    }
  }

  // Subscribe to gesture events
  useEffect(() => {
    if (!gesturesEnabled) return

    const unsubscribe = subscribe((event: DJEvent) => {
      // Update UI to show last gesture
      setLastGestureEvent(formatGestureEvent(event))

      const currentDeckRef = focusedDeck === "A" ? deckARef : deckBRef

      // Map gesture events to deck controls
      switch (event.type) {
        case 'PLAY':
          currentDeckRef.current?.handlePlayPause()
          break
        case 'PAUSE':
          currentDeckRef.current?.handlePlayPause()
          break
        case 'TEMPO_SET':
          // Map tempo to playback rate (0.8-1.2)
          currentDeckRef.current?.handlePlaybackRateStep(
            (event.value - 1.0) * 0.1
          )
          break
        case 'FILTER_SWEEP':
          // Map filter sweep to low/high cut
          if (event.value < 0.5) {
            // Low pass - decrease high cut
            const delta = (0.5 - event.value) * 10
            currentDeckRef.current?.handleHighCutStep(-delta)
          } else {
            // High pass - decrease low cut
            const delta = (event.value - 0.5) * 10
            currentDeckRef.current?.handleLowCutStep(-delta)
          }
          break
        case 'CROSSFADER_SET':
          setCrossfader(event.value)
          break
      }
    })

    return unsubscribe
  }, [gesturesEnabled, focusedDeck])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const currentDeckRef = focusedDeck === "A" ? deckARef : deckBRef

      switch (e.key) {
        case " ":
          e.preventDefault()
          currentDeckRef.current?.handlePlayPause()
          break
        case "ArrowLeft":
          e.preventDefault()
          currentDeckRef.current?.handleSeekBackward()
          break
        case "ArrowRight":
          e.preventDefault()
          currentDeckRef.current?.handleSeekForward()
          break
        case "ArrowUp":
          e.preventDefault()
          currentDeckRef.current?.handleVolumeUp()
          break
        case "ArrowDown":
          e.preventDefault()
          currentDeckRef.current?.handleVolumeDown()
          break
        case "q":
        case "Q":
          e.preventDefault()
          currentDeckRef.current?.handleLowCutStep(-1)
          break
        case "w":
        case "W":
          e.preventDefault()
          currentDeckRef.current?.handleLowCutStep(1)
          break
        case "e":
        case "E":
          e.preventDefault()
          currentDeckRef.current?.handleHighCutStep(-1)
          break
        case "r":
        case "R":
          e.preventDefault()
          currentDeckRef.current?.handleHighCutStep(1)
          break
        case "t":
        case "T":
          e.preventDefault()
          currentDeckRef.current?.handlePlaybackRateStep(0.01)
          break
        case "g":
        case "G":
          e.preventDefault()
          currentDeckRef.current?.handlePlaybackRateStep(-0.01)
          break
        case "1":
          e.preventDefault()
          setFocusedDeck("A")
          break
        case "2":
          e.preventDefault()
          setFocusedDeck("B")
          break
        case "f":
        case "F":
          e.preventDefault()
          currentDeckRef.current?.handleBandReset()
          break
        case ",":
          e.preventDefault()
          if (e.altKey) {
            currentDeckRef.current?.handleLowCutStep(-1)
          } else {
            currentDeckRef.current?.handleLowCutStep(-5)
          }
          break
        case ".":
          e.preventDefault()
          if (e.altKey) {
            currentDeckRef.current?.handleHighCutStep(1)
          } else {
            currentDeckRef.current?.handleHighCutStep(5)
          }
          break
        case "[":
          e.preventDefault()
          currentDeckRef.current?.handlePlaybackRateStep(-0.01)
          break
        case "]":
          e.preventDefault()
          currentDeckRef.current?.handlePlaybackRateStep(0.01)
          break
        case "p":
        case "P":
          e.preventDefault()
          currentDeckRef.current?.handlePitchLockToggle()
          break
        case "x":
        case "X":
          setCrossfader(0.5)
          break
        case "z":
        case "Z":
          setCrossfader((prev) => Math.max(0, prev - 0.05))
          break
        case "c":
        case "C":
          setCrossfader((prev) => Math.min(1, prev + 0.05))
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [focusedDeck])

  // Resume audio context on any user interaction (required by browser autoplay policy)
  useEffect(() => {
    const resumeAudio = async () => {
      if (audioEngine) {
        const ctx = (audioEngine as any).context
        if (ctx && ctx.state === 'suspended') {
          try {
            await ctx.resume()
            console.log('✅ Audio context resumed on user interaction')
          } catch (e) {
            console.warn('Failed to resume audio context:', e)
          }
        }
      }
    }

    // Add listeners for various user interactions
    document.addEventListener('click', resumeAudio, { once: true })
    document.addEventListener('keydown', resumeAudio, { once: true })

    return () => {
      document.removeEventListener('click', resumeAudio)
      document.removeEventListener('keydown', resumeAudio)
    }
  }, [audioEngine])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cameraStarted) {
        stopGestureModule()
      }
    }
  }, [cameraStarted])

  if (!audioEngine) {
    return (
      <div className="flex h-screen bg-background items-center justify-center">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground mb-2">DJ Vision</div>
          <div className="text-muted-foreground">Initializing audio engine...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Left Sidebar - Library */}
      <div className="w-80 flex-shrink-0 border-r border-border">
        <Library tracks={tracks} onTracksChange={setTracks} onTrackSelect={handleTrackSelect} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col gap-6 p-6 overflow-auto">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">DJ Vision</h1>
            <p className="text-sm text-muted-foreground font-mono">
              Computer Vision DJ Board
            </p>
          </div>

          {/* Gesture Controls Info */}
          <div className="rounded-lg bg-card border border-border p-3">
            <p className="text-xs text-muted-foreground mb-2 font-mono">GESTURE CONTROLS</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-primary">✋</span>
                <span className="text-muted-foreground">Palm: Play</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary">✊</span>
                <span className="text-muted-foreground">Fist: Pause</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary">👌</span>
                <span className="text-muted-foreground">Pinch: Tempo/Filter</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary">☝️</span>
                <span className="text-muted-foreground">Keys: 1/2 Deck</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Grid Layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Deck A */}
          <DeckWithControls
            deckId="A"
            track={deckATracks}
            isFocused={focusedDeck === "A"}
            onFocus={() => setFocusedDeck("A")}
            ref={deckARef}
          />

          {/* Camera Feed Panel */}
          <div className="flex flex-col gap-4">
            <div className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Hand Gesture Control
              </h3>

              {/* Camera Video Container */}
              <div className="w-full aspect-video bg-secondary rounded-lg mb-3 overflow-hidden relative">
                {!cameraStarted ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Camera not started</p>
                  </div>
                ) : (
                  <div
                    ref={videoContainerRef}
                    className="w-full h-full"
                  />
                )}
              </div>

              {/* Gesture Control Buttons */}
              <div className="flex gap-2">
                {!cameraStarted ? (
                  <button
                    onClick={handleStartGestures}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                  >
                    Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setGesturesEnabled(!gesturesEnabled)}
                      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        gesturesEnabled
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-accent'
                      }`}
                    >
                      {gesturesEnabled ? 'Gestures ON' : 'Enable Gestures'}
                    </button>
                    <button
                      onClick={handleStopGestures}
                      className="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                    >
                      Stop
                    </button>
                  </>
                )}
              </div>

              {/* Last Gesture Event */}
              {gesturesEnabled && lastGestureEvent && (
                <div className="mt-3 p-2 bg-secondary rounded text-xs text-muted-foreground font-mono">
                  {lastGestureEvent}
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="mt-3 p-2 bg-destructive/10 border border-destructive rounded text-xs text-destructive font-mono">
                  {errorMessage}
                </div>
              )}
            </div>
          </div>

          {/* Deck B */}
          <DeckWithControls
            deckId="B"
            track={deckBTracks}
            isFocused={focusedDeck === "B"}
            onFocus={() => setFocusedDeck("B")}
            ref={deckBRef}
          />
        </div>

        {/* Master Controls */}
        <MasterBar
          crossfader={crossfader}
          onCrossfaderChange={setCrossfader}
          masterVolume={masterVolume}
          onMasterVolumeChange={setMasterVolume}
        />
      </div>
    </div>
  )
}

// Helper function to format gesture events for display
function formatGestureEvent(event: DJEvent): string {
  switch (event.type) {
    case 'PLAY':
      return '▶️ PLAY'
    case 'PAUSE':
      return '⏸️ PAUSE'
    case 'TEMPO_SET':
      return `⏩ TEMPO: ${event.value.toFixed(2)}x`
    case 'FILTER_SWEEP':
      return `🎛️ FILTER: ${(event.value * 100).toFixed(0)}%`
    case 'CROSSFADER_SET':
      return `↔️ CROSSFADER: ${(event.value * 100).toFixed(0)}%`
    case 'STEM_TOGGLE':
      return `🎚️ ${event.stem.toUpperCase()}: ${event.enabled ? 'ON' : 'OFF'}`
    default:
      return `Event: ${event.type}`
  }
}

// DeckWithControls component
const DeckWithControls = React.forwardRef<
  {
    handlePlayPause: () => void
    handleSeekBackward: (amount?: number) => void
    handleSeekForward: (amount?: number) => void
    handleVolumeUp: () => void
    handleVolumeDown: () => void
    handleLowCutStep: (delta: number) => void
    handleHighCutStep: (delta: number) => void
    handleBandReset: () => void
    handlePlaybackRateStep: (delta: number) => void
    handlePitchLockToggle: () => void
  },
  {
    deckId: DeckId
    track: AudioTrack | null
    isFocused: boolean
    onFocus: () => void
  }
>(({ deckId, track, isFocused, onFocus }, ref) => {
  const [volume, setVolume] = useState(0.8)
  const [audioEngine, setAudioEngine] = useState<any>(null)
  const [player, setPlayer] = useState<any>(null)
  const playerRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const engine = getAudioEngine()
      setAudioEngine(engine)
      setPlayer(engine.getDeck(deckId))
    }
  }, [deckId])

  React.useImperativeHandle(ref, () => ({
    handlePlayPause: () => {
      if (playerRef.current) {
        playerRef.current.handlePlayPause()
      }
    },
    handleSeekBackward: (amount = 5) => {
      if (playerRef.current) {
        playerRef.current.handleSeekBackward(amount)
      }
    },
    handleSeekForward: (amount = 5) => {
      if (playerRef.current) {
        playerRef.current.handleSeekForward(amount)
      }
    },
    handleVolumeUp: () => {
      setVolume((v) => Math.min(1, v + 0.05))
    },
    handleVolumeDown: () => {
      setVolume((v) => Math.max(0, v - 0.05))
    },
    handleLowCutStep: (delta: number) => {
      if (playerRef.current) {
        playerRef.current.handleLowCutStep(delta)
      }
    },
    handleHighCutStep: (delta: number) => {
      if (playerRef.current) {
        playerRef.current.handleHighCutStep(delta)
      }
    },
    handleBandReset: () => {
      if (playerRef.current) {
        playerRef.current.handleBandReset()
      }
    },
    handlePlaybackRateStep: (delta: number) => {
      if (playerRef.current) {
        playerRef.current.handlePlaybackRateStep(delta)
      }
    },
    handlePitchLockToggle: () => {
      if (playerRef.current) {
        playerRef.current.handlePitchLockToggle()
      }
    },
  }))

  if (!audioEngine || !player) {
    return (
      <div className="flex items-center justify-center h-64 bg-card rounded-lg border border-border">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Loading Deck {deckId}...</div>
        </div>
      </div>
    )
  }

  return (
    <Deck
      deckId={deckId}
      track={track}
      isFocused={isFocused}
      onFocus={onFocus}
      ref={playerRef}
      volume={volume}
      onVolumeChange={setVolume}
      player={player}
    />
  )
})

DeckWithControls.displayName = "DeckWithControls"
