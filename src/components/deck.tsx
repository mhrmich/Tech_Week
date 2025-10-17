import { useEffect, useState, useImperativeHandle, forwardRef } from "react"
import { Volume2, Gauge } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { Transport } from "@/components/transport"
import { Waveform } from "@/components/waveform"
import { VUMeter } from "@/components/vu-meter"
import type { AudioTrack, DeckId } from "@/lib/types"
import type { DeckPlayer } from "@/lib/audio-engine"
import { resumeAudioContext } from "@/lib/audio-context"
import { cn } from "@/lib/utils"
import { engineA, engineB } from "@/gesture/index"

interface DeckProps {
  deckId: DeckId
  track: AudioTrack | null
  isFocused: boolean
  onFocus: () => void
  volume: number
  onVolumeChange: (volume: number) => void
  player: DeckPlayer
}

export const Deck = forwardRef<any, DeckProps>(
  ({ deckId, track, isFocused, onFocus, volume, onVolumeChange, player }, ref) => {
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [lowCutPercent, setLowCutPercent] = useState(0)
    const [highCutPercent, setHighCutPercent] = useState(100)
    const [lowCutHz, setLowCutHz] = useState(20)
    const [highCutHz, setHighCutHz] = useState(20000)
    const [playbackRate, setPlaybackRate] = useState(1.0)
    const [meterData, setMeterData] = useState({ peak: 0, rms: 0 })

    const percentToHz = (percent: number): number => {
      return 20 * Math.pow(20000 / 20, percent / 100)
    }

    useEffect(() => {
      player.setVolume(volume)
      player.setOnTimeUpdate(setCurrentTime)

      const savedLowCut = localStorage.getItem(`deck-${deckId}-low-cut`)
      const savedHighCut = localStorage.getItem(`deck-${deckId}-high-cut`)
      const savedPlaybackRate = localStorage.getItem(`deck-${deckId}-playback-rate`)

      const engine = deckId === "A" ? engineA : engineB
      let lowCut = 0
      let highCut = 100

      if (savedLowCut !== null) {
        const percent = Number.parseFloat(savedLowCut)
        lowCut = percent
        setLowCutPercent(percent)
        setLowCutHz(percentToHz(percent))
      }

      if (savedHighCut !== null) {
        const percent = Number.parseFloat(savedHighCut)
        highCut = percent
        setHighCutPercent(percent)
        setHighCutHz(percentToHz(percent))
      }

      // Calculate and set initial engine filter value from saved sliders
      if (lowCut > 0) {
        const filterValue = 0.5 + (lowCut / 75) * 0.5
        engine.setFilter(filterValue)
      } else if (highCut < 100) {
        const filterValue = ((highCut - 25) / 75) * 0.5
        engine.setFilter(Math.max(0, filterValue))
      } else {
        engine.setFilter(0.5)
      }

      if (savedPlaybackRate !== null) {
        const rate = Number.parseFloat(savedPlaybackRate)
        setPlaybackRate(rate)
        player.setPlaybackRate(rate)
      }

      const updateMeter = () => {
        const data = player.getMeterData()
        setMeterData(data)
        requestAnimationFrame(updateMeter)
      }
      const frameId = requestAnimationFrame(updateMeter)

      return () => {
        cancelAnimationFrame(frameId)
      }
    }, [deckId, player])

    useEffect(() => {
      if (track?.buffer) {
        player.loadTrack(track.buffer)
        setIsPlaying(false)
        setCurrentTime(0)
      }
    }, [track, player])

    useEffect(() => {
      player.setVolume(volume)
    }, [volume, player])

    // Helper: Map filter value (0-1) to UI slider percentages
    const mapFilterToSliders = (filterValue: number): { lowCut: number, highCut: number } => {
      if (filterValue < 0.5) {
        // Lowpass mode: cut highs, keep lows
        const t = filterValue / 0.5; // 0-1 within lowpass range
        return {
          lowCut: 0,
          highCut: 25 + (75 * t) // 25% to 100%
        };
      } else {
        // Highpass mode: cut lows, keep highs
        const t = (filterValue - 0.5) / 0.5; // 0-1 within highpass range
        return {
          lowCut: 75 * t, // 0% to 75%
          highCut: 100
        };
      }
    };

    // Poll engine state to sync UI with gesture-controlled engines
    useEffect(() => {
      const engine = deckId === "A" ? engineA : engineB

      const pollState = () => {
        const actualIsPlaying = engine.isPlaying()
        if (actualIsPlaying !== isPlaying) {
          setIsPlaying(actualIsPlaying)
        }

        // Sync playback rate display
        const state = engine.getState()
        if (Math.abs(state.tempoFactor - playbackRate) > 0.01) {
          setPlaybackRate(state.tempoFactor)
        }

        // Sync filter sliders with engine filter value
        const sliders = mapFilterToSliders(state.filter)
        if (Math.abs(sliders.lowCut - lowCutPercent) > 1) {
          setLowCutPercent(sliders.lowCut)
          setLowCutHz(percentToHz(sliders.lowCut))
        }
        if (Math.abs(sliders.highCut - highCutPercent) > 1) {
          setHighCutPercent(sliders.highCut)
          setHighCutHz(percentToHz(sliders.highCut))
        }
      }

      // Poll every 100ms to keep UI in sync
      const interval = setInterval(pollState, 100)
      return () => clearInterval(interval)
    }, [deckId, isPlaying, playbackRate, lowCutPercent, highCutPercent])

    const handlePlayPause = () => {
      if (!track) return

      resumeAudioContext()

      // Control the actual Tone.js engine directly (same as gestures do)
      const engine = deckId === "A" ? engineA : engineB
      if (isPlaying) {
        engine.pause()
        setIsPlaying(false)
      } else {
        engine.play()
        setIsPlaying(true)
      }
    }

    const handleSeek = (time: number) => {
      player.seek(time)
      setCurrentTime(time)
    }

    const handleSeekBackward = (amount = 5) => {
      handleSeek(Math.max(0, currentTime - amount))
    }

    const handleSeekForward = (amount = 5) => {
      handleSeek(Math.min(track?.duration || 0, currentTime + amount))
    }

    const handleLowCutChange = (value: number) => {
      const clampedValue = Math.min(value, highCutPercent - 1)
      setLowCutPercent(clampedValue)
      setLowCutHz(percentToHz(clampedValue))

      // Map sliders back to filter value and update engine
      const engine = deckId === "A" ? engineA : engineB
      if (clampedValue > 0) {
        // Low-cut active = highpass mode (filter > 0.5)
        const filterValue = 0.5 + (clampedValue / 75) * 0.5 // Map 0-75% to 0.5-1.0
        engine.setFilter(filterValue)
      } else if (highCutPercent < 100) {
        // Only high-cut active = lowpass mode (filter < 0.5)
        const filterValue = ((highCutPercent - 25) / 75) * 0.5 // Map 25-100% to 0.0-0.5
        engine.setFilter(Math.max(0, filterValue))
      } else {
        // Both neutral = center position
        engine.setFilter(0.5)
      }

      localStorage.setItem(`deck-${deckId}-low-cut`, clampedValue.toString())
    }

    const handleHighCutChange = (value: number) => {
      const clampedValue = Math.max(value, lowCutPercent + 1)
      setHighCutPercent(clampedValue)
      setHighCutHz(percentToHz(clampedValue))

      // Map sliders back to filter value and update engine
      const engine = deckId === "A" ? engineA : engineB
      if (lowCutPercent > 0) {
        // Low-cut active = highpass mode (filter > 0.5)
        const filterValue = 0.5 + (lowCutPercent / 75) * 0.5 // Map 0-75% to 0.5-1.0
        engine.setFilter(filterValue)
      } else if (clampedValue < 100) {
        // Only high-cut active = lowpass mode (filter < 0.5)
        const filterValue = ((clampedValue - 25) / 75) * 0.5 // Map 25-100% to 0.0-0.5
        engine.setFilter(Math.max(0, filterValue))
      } else {
        // Both neutral = center position
        engine.setFilter(0.5)
      }

      localStorage.setItem(`deck-${deckId}-high-cut`, clampedValue.toString())
    }

    const handleLowCutStep = (delta: number) => {
      const newValue = Math.max(0, Math.min(100, lowCutPercent + delta))
      handleLowCutChange(newValue)
    }

    const handleHighCutStep = (delta: number) => {
      const newValue = Math.max(0, Math.min(100, highCutPercent + delta))
      handleHighCutChange(newValue)
    }

    const handleBandReset = () => {
      setLowCutPercent(0)
      setHighCutPercent(100)
      setLowCutHz(20)
      setHighCutHz(20000)

      // Reset engine filter to neutral
      const engine = deckId === "A" ? engineA : engineB
      engine.setFilter(0.5)

      localStorage.setItem(`deck-${deckId}-low-cut`, "0")
      localStorage.setItem(`deck-${deckId}-high-cut`, "100")
    }

    const handlePlaybackRateChange = (value: number) => {
      setPlaybackRate(value)
      player.setPlaybackRate(value)
      localStorage.setItem(`deck-${deckId}-playback-rate`, value.toString())
    }

    const handlePlaybackRateStep = (delta: number) => {
      const newValue = Math.max(0.5, Math.min(2.0, playbackRate + delta))
      handlePlaybackRateChange(newValue)
    }

    useImperativeHandle(ref, () => ({
      handlePlayPause,
      handleSeekBackward,
      handleSeekForward,
      handleLowCutStep,
      handleHighCutStep,
      handleBandReset,
      handlePlaybackRateStep,
    }))

    const formatTime = (seconds: number) => {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}:${secs.toString().padStart(2, "0")}`
    }

    const formatFrequency = (hz: number) => {
      if (hz >= 1000) {
        return `${(hz / 1000).toFixed(1)} kHz`
      }
      return `${Math.round(hz)} Hz`
    }

    return (
      <div
        className={cn(
          "flex flex-col gap-4 rounded-lg border-2 bg-card p-6 transition-colors overflow-hidden",
          isFocused ? "border-primary" : "border-border",
        )}
        onClick={onFocus}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg font-mono text-lg font-bold",
                deckId === "A" ? "bg-chart-2/20 text-chart-2" : "bg-chart-4/20 text-chart-4",
              )}
            >
              {deckId}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{track?.name || "No track loaded"}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {track ? `${formatTime(currentTime)} / ${formatTime(track.duration)}` : "--:-- / --:--"}
              </p>
            </div>
          </div>
          <div className="w-32">
            <VUMeter peak={meterData.peak} rms={meterData.rms} />
          </div>
        </div>

        <Waveform
          peaks={track?.peaks || []}
          currentTime={currentTime}
          duration={track?.duration || 0}
          onSeek={handleSeek}
        />

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-12">{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            onValueChange={(values) => handleSeek(values[0])}
            max={track?.duration || 100}
            step={0.1}
            className="flex-1"
            disabled={!track}
            aria-label={`Timeline for deck ${deckId}`}
          />
          <span className="text-xs font-mono text-muted-foreground w-12 text-right">
            {formatTime(track?.duration || 0)}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <Transport
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onSeekBackward={handleSeekBackward}
            onSeekForward={handleSeekForward}
            disabled={!track}
          />

          <div className="flex flex-1 items-center gap-3">
            <Volume2 className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[volume * 100]}
              onValueChange={(values) => onVolumeChange(values[0] / 100)}
              max={100}
              step={1}
              className="flex-1"
            />
            <span className="text-xs font-mono text-muted-foreground w-8 text-right">{Math.round(volume * 100)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground w-16">Low-cut</span>
            <Slider
              value={[lowCutPercent]}
              onValueChange={(values) => handleLowCutChange(values[0])}
              max={100}
              step={0.01}
              className="flex-1"
              aria-label={`Low-cut filter for deck ${deckId}`}
            />
            <span className="text-xs font-mono text-muted-foreground w-16 text-right">{formatFrequency(lowCutHz)}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-muted-foreground w-16">High-cut</span>
            <Slider
              value={[highCutPercent]}
              onValueChange={(values) => handleHighCutChange(values[0])}
              max={100}
              step={0.01}
              className="flex-1"
              aria-label={`High-cut filter for deck ${deckId}`}
            />
            <span className="text-xs font-mono text-muted-foreground w-16 text-right">
              {formatFrequency(highCutHz)}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-2 border-t border-border">
          <div className="flex items-center gap-3">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-mono text-muted-foreground w-12">Speed</span>
            <Slider
              value={[playbackRate * 100]}
              onValueChange={(values) => handlePlaybackRateChange(values[0] / 100)}
              min={50}
              max={200}
              step={0.5}
              className="flex-1"
              aria-label={`Playback rate for deck ${deckId}`}
            />
            <span className="text-xs font-mono text-muted-foreground w-12 text-right">{playbackRate.toFixed(2)}×</span>
          </div>
        </div>
      </div>
    )
  },
)

Deck.displayName = "Deck"
