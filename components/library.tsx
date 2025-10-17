"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Upload, Music, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { AudioTrack } from "@/lib/types"
import { getAudioContext, resumeAudioContext } from "@/lib/audio-context"
import { decodeAudioFile, generatePeaks } from "@/lib/audio-engine"
import { cn } from "@/lib/utils"

interface LibraryProps {
  tracks: AudioTrack[]
  onTracksChange: (tracks: AudioTrack[]) => void
  onTrackSelect: (track: AudioTrack) => void
}

export function Library({ tracks, onTracksChange, onTrackSelect }: LibraryProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList) => {
    const audioContext = getAudioContext()
    resumeAudioContext()

    const newTracks: AudioTrack[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith("audio/")) continue

      try {
        const buffer = await decodeAudioFile(audioContext, file)
        const peaks = generatePeaks(buffer, 1000)

        const track: AudioTrack = {
          id: `${Date.now()}-${i}`,
          name: file.name.replace(/\.[^/.]+$/, ""),
          file,
          buffer,
          peaks,
          duration: buffer.duration,
        }

        newTracks.push(track)
      } catch (error) {
        console.error(`Failed to load ${file.name}:`, error)
      }
    }

    onTracksChange([...tracks, ...newTracks])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files)
    }
  }

  const handleRemoveTrack = (trackId: string) => {
    onTracksChange(tracks.filter((t) => t.id !== trackId))
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex h-full flex-col bg-card border-r border-border">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="font-mono text-sm font-semibold text-foreground">LIBRARY</h2>
        <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} className="h-8">
          <Upload className="mr-2 h-3 w-3" />
          Add Files
        </Button>
        <input ref={fileInputRef} type="file" accept="audio/*" multiple className="hidden" onChange={handleFileInput} />
      </div>

      <div
        className={cn("flex-1 transition-colors", isDragging && "bg-accent/20")}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {tracks.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="rounded-full bg-muted p-6">
              <Music className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">No tracks loaded</p>
              <p className="text-xs text-muted-foreground">Drag and drop audio files here or click Add Files</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-1 p-2">
              {tracks.map((track) => (
                <div
                  key={track.id}
                  className="group flex items-center gap-3 rounded-md bg-secondary/50 p-3 hover:bg-secondary cursor-pointer transition-colors"
                  onClick={() => onTrackSelect(track)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/20">
                    <Music className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{track.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDuration(track.duration)}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemoveTrack(track.id)
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
