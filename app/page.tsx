"use client"

import React from "react"

import { useState, useEffect, useRef } from "react"
import { Library } from "@/components/library"
import { Deck } from "@/components/deck"
import { MasterBar } from "@/components/master-bar"
import type { AudioTrack, DeckId } from "@/lib/types"
import { getAudioEngine } from "@/lib/audio-context"

export default function DJVisionApp() {
  const [tracks, setTracks] = useState<AudioTrack[]>([])
  const [deckATracks, setDeckATracks] = useState<AudioTrack | null>(null)
  const [deckBTracks, setDeckBTracks] = useState<AudioTrack | null>(null)
  const [focusedDeck, setFocusedDeck] = useState<DeckId>("A")
  const [crossfader, setCrossfader] = useState(0.5)
  const [masterVolume, setMasterVolume] = useState(0.8)

  const audioEngine = getAudioEngine()

  const deckARef = useRef<{
    handlePlayPause: () => void
    handleSeekBackward: (amount?: number) => void
    handleSeekForward: (amount?: number) => void
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
    handleLowCutStep: (delta: number) => void
    handleHighCutStep: (delta: number) => void
    handleBandReset: () => void
    handlePlaybackRateStep: (delta: number) => void
    handlePitchLockToggle: () => void
  } | null>(null)

  useEffect(() => {
    audioEngine.setCrossfader(crossfader)
  }, [crossfader, audioEngine])

  useEffect(() => {
    audioEngine.setMasterVolume(masterVolume)
  }, [masterVolume, audioEngine])

  const handleTrackSelect = (track: AudioTrack) => {
    if (focusedDeck === "A") {
      setDeckATracks(track)
    } else {
      setDeckBTracks(track)
    }
  }

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
          if (e.shiftKey) {
            currentDeckRef.current?.handleSeekBackward(8)
          } else {
            currentDeckRef.current?.handleSeekBackward(2)
          }
          break
        case "ArrowRight":
          e.preventDefault()
          if (e.shiftKey) {
            currentDeckRef.current?.handleSeekForward(8)
          } else {
            currentDeckRef.current?.handleSeekForward(2)
          }
          break
        case "ArrowUp":
          e.preventDefault()
          currentDeckRef.current?.handlePlaybackRateStep(0.01)
          break
        case "ArrowDown":
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
            currentDeckRef.current?.handleHighCutStep(-1)
          }
          break
        case ".":
          e.preventDefault()
          if (e.altKey) {
            currentDeckRef.current?.handleLowCutStep(1)
          } else {
            currentDeckRef.current?.handleHighCutStep(1)
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
          e.preventDefault()
          setCrossfader(0.5)
          break
        case "z":
        case "Z":
          e.preventDefault()
          setCrossfader((prev) => Math.max(0, prev - 0.05))
          break
        case "c":
        case "C":
          e.preventDefault()
          setCrossfader((prev) => Math.min(1, prev + 0.05))
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [focusedDeck])

  return (
    <div className="flex h-screen bg-background">
      <div className="w-80 flex-shrink-0">
        <Library tracks={tracks} onTracksChange={setTracks} onTrackSelect={handleTrackSelect} />
      </div>

      <div className="flex-1 flex flex-col gap-6 p-6 overflow-auto">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">DJ Vision</h1>
            <p className="text-sm text-muted-foreground font-mono">Beta</p>
          </div>
          <div className="rounded-lg bg-card border border-border p-3">
            <p className="text-xs text-muted-foreground mb-2 font-mono">KEYBOARD SHORTCUTS</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">Space</kbd>
                <span className="text-muted-foreground">Play/Pause</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">←/→</kbd>
                <span className="text-muted-foreground">Seek ±2s</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">Shift+←/→</kbd>
                <span className="text-muted-foreground">Seek ±8s</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">↑/↓</kbd>
                <span className="text-muted-foreground">Speed</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">1/2</kbd>
                <span className="text-muted-foreground">Switch Deck</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">F</kbd>
                <span className="text-muted-foreground">Reset Band</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">,/.</kbd>
                <span className="text-muted-foreground">High-cut ±1%</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">Alt+,/.</kbd>
                <span className="text-muted-foreground">Low-cut ±1%</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">[/]</kbd>
                <span className="text-muted-foreground">Speed ±0.01×</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">X</kbd>
                <span className="text-muted-foreground">Center X-fade</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">Z/C</kbd>
                <span className="text-muted-foreground">X-fade A/B</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground font-mono">P</kbd>
                <span className="text-muted-foreground">Pitch Lock</span>
              </div>
            </div>
          </div>
        </header>

        <MasterBar
          crossfader={crossfader}
          onCrossfaderChange={setCrossfader}
          masterVolume={masterVolume}
          onMasterVolumeChange={setMasterVolume}
        />

        <div className="grid gap-6 lg:grid-cols-2">
          <DeckWithControls
            deckId="A"
            track={deckATracks}
            isFocused={focusedDeck === "A"}
            onFocus={() => setFocusedDeck("A")}
            ref={deckARef}
          />
          <DeckWithControls
            deckId="B"
            track={deckBTracks}
            isFocused={focusedDeck === "B"}
            onFocus={() => setFocusedDeck("B")}
            ref={deckBRef}
          />
        </div>
      </div>
    </div>
  )
}

const DeckWithControls = React.forwardRef<
  {
    handlePlayPause: () => void
    handleSeekBackward: (amount?: number) => void
    handleSeekForward: (amount?: number) => void
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
  const playerRef = useRef<any>(null)

  const audioEngine = getAudioEngine()
  const player = audioEngine.getDeck(deckId)

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
