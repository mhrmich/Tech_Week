export interface AudioTrack {
  id: string
  name: string
  file: File
  buffer: AudioBuffer | null
  peaks: number[]
  duration: number
}

export interface DeckState {
  track: AudioTrack | null
  isPlaying: boolean
  currentTime: number
  volume: number
}

export type DeckId = "A" | "B"
