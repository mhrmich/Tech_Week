import { useState, useRef } from "react"
import { Upload, Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { engineA, engineB } from "@/gesture/index"
import { getAudioContext } from "@/lib/audio-context"
import { generatePeaks } from "@/lib/audio-engine"
import type { AudioTrack, DeckId } from "@/lib/types"

interface LibraryProps {
  onDeckATrackLoad: (track: AudioTrack, bpm?: number) => void
  onDeckBTrackLoad: (track: AudioTrack, bpm?: number) => void
}

export function Library({ onDeckATrackLoad, onDeckBTrackLoad }: LibraryProps) {
  // Deck A stem state
  const [vocalFileA, setVocalFileA] = useState<File | null>(null)
  const [backingFileA, setBackingFileA] = useState<File | null>(null)
  const [bpmA, setBpmA] = useState<string>("")
  const vocalInputRefA = useRef<HTMLInputElement>(null)
  const backingInputRefA = useRef<HTMLInputElement>(null)

  // Deck B stem state
  const [vocalFileB, setVocalFileB] = useState<File | null>(null)
  const [backingFileB, setBackingFileB] = useState<File | null>(null)
  const [bpmB, setBpmB] = useState<string>("")
  const vocalInputRefB = useRef<HTMLInputElement>(null)
  const backingInputRefB = useRef<HTMLInputElement>(null)

  // Load stems for Deck A
  const loadStemsA = async (vocal: File, backing: File) => {
    try {
      const vocalUrl = URL.createObjectURL(vocal)
      const backingUrl = URL.createObjectURL(backing)

      console.log(`🎵 Deck A - Loading stems...`)
      await engineA.loadStems({
        vocals: vocalUrl,
        drums: backingUrl,
        bass: backingUrl,
      })
      console.log(`✅ Deck A - Stems loaded successfully!`)

      // Create dummy track for waveform visualization
      const audioContext = getAudioContext()
      const backingBuffer = await audioContext.decodeAudioData(await backing.arrayBuffer())
      const peaks = generatePeaks(backingBuffer, 1000)

      const track: AudioTrack = {
        id: `deck-a-${Date.now()}`,
        name: `${vocal.name.replace(/\.[^/.]+$/, "")} + ${backing.name.replace(/\.[^/.]+$/, "")}`,
        file: backing,
        buffer: backingBuffer,
        peaks,
        duration: backingBuffer.duration,
      }
      const bpmValue = bpmA ? parseFloat(bpmA) : undefined
      onDeckATrackLoad(track, bpmValue)
    } catch (error) {
      console.error(`❌ Deck A - Failed to load stems:`, error)
    }
  }

  // Load stems for Deck B
  const loadStemsB = async (vocal: File, backing: File) => {
    try {
      const vocalUrl = URL.createObjectURL(vocal)
      const backingUrl = URL.createObjectURL(backing)

      console.log(`🎵 Deck B - Loading stems...`)
      await engineB.loadStems({
        vocals: vocalUrl,
        drums: backingUrl,
        bass: backingUrl,
      })
      console.log(`✅ Deck B - Stems loaded successfully!`)

      // Create dummy track for waveform visualization
      const audioContext = getAudioContext()
      const backingBuffer = await audioContext.decodeAudioData(await backing.arrayBuffer())
      const peaks = generatePeaks(backingBuffer, 1000)

      const track: AudioTrack = {
        id: `deck-b-${Date.now()}`,
        name: `${vocal.name.replace(/\.[^/.]+$/, "")} + ${backing.name.replace(/\.[^/.]+$/, "")}`,
        file: backing,
        buffer: backingBuffer,
        peaks,
        duration: backingBuffer.duration,
      }
      const bpmValue = bpmB ? parseFloat(bpmB) : undefined
      onDeckBTrackLoad(track, bpmValue)
    } catch (error) {
      console.error(`❌ Deck B - Failed to load stems:`, error)
    }
  }

  // Deck A handlers
  const handleVocalUploadA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVocalFileA(file)
      console.log(`📁 Deck A - Vocal uploaded: ${file.name}`)

      // Auto-load if backing is already uploaded
      if (backingFileA) {
        loadStemsA(file, backingFileA)
      }
    }
  }

  const handleBackingUploadA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBackingFileA(file)
      console.log(`📁 Deck A - Backing uploaded: ${file.name}`)

      // Auto-load if vocal is already uploaded
      if (vocalFileA) {
        loadStemsA(vocalFileA, file)
      }
    }
  }

  // Deck B handlers
  const handleVocalUploadB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVocalFileB(file)
      console.log(`📁 Deck B - Vocal uploaded: ${file.name}`)

      // Auto-load if backing is already uploaded
      if (backingFileB) {
        loadStemsB(file, backingFileB)
      }
    }
  }

  const handleBackingUploadB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setBackingFileB(file)
      console.log(`📁 Deck B - Backing uploaded: ${file.name}`)

      // Auto-load if vocal is already uploaded
      if (vocalFileB) {
        loadStemsB(vocalFileB, file)
      }
    }
  }

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="border-b border-border p-4">
        <h2 className="font-mono text-sm font-semibold text-foreground">STEM UPLOADS</h2>
        <p className="text-xs text-muted-foreground mt-1">Upload vocal + backing tracks for each deck</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Deck A Section */}
        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-2/20 text-chart-2 font-mono text-sm font-bold">
              A
            </div>
            <h3 className="font-semibold text-sm">Deck A Stems</h3>
          </div>

          <div className="space-y-2">
            {/* Vocal Upload A */}
            <input
              ref={vocalInputRefA}
              type="file"
              accept="audio/*"
              onChange={handleVocalUploadA}
              className="hidden"
            />
            <Button
              size="sm"
              variant={vocalFileA ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => vocalInputRefA.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {vocalFileA ? (
                <span className="truncate">{vocalFileA.name}</span>
              ) : (
                "Upload Vocal"
              )}
            </Button>

            {/* Backing Upload A */}
            <input
              ref={backingInputRefA}
              type="file"
              accept="audio/*"
              onChange={handleBackingUploadA}
              className="hidden"
            />
            <Button
              size="sm"
              variant={backingFileA ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => backingInputRefA.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {backingFileA ? (
                <span className="truncate">{backingFileA.name}</span>
              ) : (
                "Upload Backing"
              )}
            </Button>

            {/* BPM Input A */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-muted-foreground whitespace-nowrap">BPM:</label>
              <Input
                type="number"
                placeholder="120"
                value={bpmA}
                onChange={(e) => setBpmA(e.target.value)}
                className="h-8 text-xs"
                min="60"
                max="200"
              />
            </div>

            {vocalFileA && backingFileA && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md">
                <Music className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  Stems loaded & ready!
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Deck B Section */}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-4/20 text-chart-4 font-mono text-sm font-bold">
              B
            </div>
            <h3 className="font-semibold text-sm">Deck B Stems</h3>
          </div>

          <div className="space-y-2">
            {/* Vocal Upload B */}
            <input
              ref={vocalInputRefB}
              type="file"
              accept="audio/*"
              onChange={handleVocalUploadB}
              className="hidden"
            />
            <Button
              size="sm"
              variant={vocalFileB ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => vocalInputRefB.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {vocalFileB ? (
                <span className="truncate">{vocalFileB.name}</span>
              ) : (
                "Upload Vocal"
              )}
            </Button>

            {/* Backing Upload B */}
            <input
              ref={backingInputRefB}
              type="file"
              accept="audio/*"
              onChange={handleBackingUploadB}
              className="hidden"
            />
            <Button
              size="sm"
              variant={backingFileB ? "default" : "outline"}
              className="w-full justify-start"
              onClick={() => backingInputRefB.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              {backingFileB ? (
                <span className="truncate">{backingFileB.name}</span>
              ) : (
                "Upload Backing"
              )}
            </Button>

            {/* BPM Input B */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-muted-foreground whitespace-nowrap">BPM:</label>
              <Input
                type="number"
                placeholder="120"
                value={bpmB}
                onChange={(e) => setBpmB(e.target.value)}
                className="h-8 text-xs"
                min="60"
                max="200"
              />
            </div>

            {vocalFileB && backingFileB && (
              <div className="flex items-center gap-2 p-2 bg-green-500/10 rounded-md">
                <Music className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  Stems loaded & ready!
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Hand Mapping Info */}
        <div className="p-4 border-t border-border">
          <h3 className="font-semibold text-xs text-muted-foreground mb-2">GESTURE CONTROLS</h3>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-16 text-right font-mono">Right Hand</div>
              <div className="text-chart-2">→ Deck A</div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 text-right font-mono">Left Hand</div>
              <div className="text-chart-4">→ Deck B</div>
            </div>
            <div className="border-t border-border pt-2 mt-2 space-y-1">
              <div>Palm = PLAY</div>
              <div>Fist = PAUSE</div>
              <div>Pinch = Tempo + Filter</div>
              <div>1 finger = Toggle Vocals</div>
              <div>2 fingers = Toggle Backing</div>
              <div>3 fingers = Crossfade</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
