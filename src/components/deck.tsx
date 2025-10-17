import { useEffect, useState, useImperativeHandle, forwardRef, useRef } from "react"
import { Volume2, Gauge, Upload } from "lucide-react"
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
    const [pitchLock, setPitchLock] = useState(false)
    const [meterData, setMeterData] = useState({ peak: 0, rms: 0 })

    // Stem upload state
    const [vocalFile, setVocalFile] = useState<File | null>(null)
    const [instrumentalFile, setInstrumentalFile] = useState<File | null>(null)
    const vocalInputRef = useRef<HTMLInputElement>(null)
    const instrumentalInputRef = useRef<HTMLInputElement>(null)

    const percentToHz = (percent: number): number => {
      return 20 * Math.pow(20000 / 20, percent / 100)
    }

    // Stem upload handlers
    const handleVocalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setVocalFile(file)
        console.log(`📁 Deck ${deckId} - Vocal stem uploaded: ${file.name}`)
      }
    }

    const handleInstrumentalUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setInstrumentalFile(file)
        console.log(`📁 Deck ${deckId} - Instrumental stem uploaded: ${file.name}`)
      }
    }

    // Load stems into Tone.js engine when both files are present
    useEffect(() => {
      if (vocalFile && instrumentalFile) {
        const loadStems = async () => {
          try {
            const engine = deckId === "A" ? engineA : engineB
            const vocalUrl = URL.createObjectURL(vocalFile)
            const instrumentalUrl = URL.createObjectURL(instrumentalFile)

            console.log(`🎵 Deck ${deckId} - Loading stems...`)
            await engine.loadStems({
              vocals: vocalUrl,
              drums: instrumentalUrl,
              bass: instrumentalUrl,
            })
            console.log(`✅ Deck ${deckId} - Stems loaded successfully!`)
          } catch (error) {
            console.error(`❌ Deck ${deckId} - Failed to load stems:`, error)
          }
        }
        loadStems()
      }
    }, [vocalFile, instrumentalFile, deckId])

    useEffect(() => {
      player.setVolume(volume)
      player.setOnTimeUpdate(setCurrentTime)

      const savedLowCut = localStorage.getItem(`deck-${deckId}-low-cut`)
      const savedHighCut = localStorage.getItem(`deck-${deckId}-high-cut`)
      const savedPlaybackRate = localStorage.getItem(`deck-${deckId}-playback-rate`)
      const savedPitchLock = localStorage.getItem(`deck-${deckId}-pitch-lock`)

      if (savedLowCut !== null) {
        const percent = Number.parseFloat(savedLowCut)
        setLowCutPercent(percent)
        setLowCutHz(percentToHz(percent))
        player.setLowCut(percent)
      }

      if (savedHighCut !== null) {
        const percent = Number.parseFloat(savedHighCut)
        setHighCutPercent(percent)
        setHighCutHz(percentToHz(percent))
        player.setHighCut(percent)
      }

      if (savedPlaybackRate !== null) {
        const rate = Number.parseFloat(savedPlaybackRate)
        setPlaybackRate(rate)
        player.setPlaybackRate(rate)
      }

      if (savedPitchLock !== null) {
        const enabled = savedPitchLock === "true"
        setPitchLock(enabled)
        player.setPitchLock(enabled)
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

    const handlePlayPause = () => {
      if (!track) return

      resumeAudioContext()

      if (isPlaying) {
        player.pause()
        setIsPlaying(false)
      } else {
        player.play()
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
      player.setLowCut(clampedValue)
      localStorage.setItem(`deck-${deckId}-low-cut`, clampedValue.toString())
    }

    const handleHighCutChange = (value: number) => {
      const clampedValue = Math.max(value, lowCutPercent + 1)
      setHighCutPercent(clampedValue)
      setHighCutHz(percentToHz(clampedValue))
      player.setHighCut(clampedValue)
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
      player.resetBand()
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

    const handlePitchLockToggle = () => {
      const newValue = !pitchLock
      setPitchLock(newValue)
      player.setPitchLock(newValue)
      localStorage.setItem(`deck-${deckId}-pitch-lock`, newValue.toString())
    }

    useImperativeHandle(ref, () => ({
      handlePlayPause,
      handleSeekBackward,
      handleSeekForward,
      handleLowCutStep,
      handleHighCutStep,
      handleBandReset,
      handlePlaybackRateStep,
      handlePitchLockToggle,
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

        {/* Stem Upload Section */}
        <div className="flex gap-2">
          <input
            ref={vocalInputRef}
            type="file"
            accept="audio/*"
            onChange={handleVocalUpload}
            className="hidden"
          />
          <input
            ref={instrumentalInputRef}
            type="file"
            accept="audio/*"
            onChange={handleInstrumentalUpload}
            className="hidden"
          />
          <Button
            size="sm"
            variant={vocalFile ? "default" : "outline"}
            className="flex-1"
            onClick={() => vocalInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {vocalFile ? `✅ ${vocalFile.name.slice(0, 15)}...` : '🎤 Upload Vocal'}
          </Button>
          <Button
            size="sm"
            variant={instrumentalFile ? "default" : "outline"}
            className="flex-1"
            onClick={() => instrumentalInputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {instrumentalFile ? `✅ ${instrumentalFile.name.slice(0, 15)}...` : '🎸 Upload Backing'}
          </Button>
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

          <div className="flex items-center gap-3">
            <Button
              variant={pitchLock ? "default" : "outline"}
              size="sm"
              onClick={handlePitchLockToggle}
              className="text-xs font-mono h-7 px-3"
            >
              Pitch Lock {pitchLock ? "ON" : "OFF"}
              <span className="ml-1 text-[10px] opacity-60">(beta)</span>
            </Button>
          </div>
        </div>
      </div>
    )
  },
)

Deck.displayName = "Deck"
