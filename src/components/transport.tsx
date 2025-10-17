import { Play, Pause, SkipBack, SkipForward } from "lucide-react"
import { Button } from "@/components/ui/button"

interface TransportProps {
  isPlaying: boolean
  onPlayPause: () => void
  onSeekBackward: () => void
  onSeekForward: () => void
  disabled?: boolean
}

export function Transport({ isPlaying, onPlayPause, onSeekBackward, onSeekForward, disabled = false }: TransportProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        size="icon"
        variant="outline"
        onClick={onSeekBackward}
        disabled={disabled}
        className="h-8 w-8 bg-transparent"
      >
        <SkipBack className="h-4 w-4" />
      </Button>
      <Button
        size="icon"
        onClick={onPlayPause}
        disabled={disabled}
        className="h-10 w-10 bg-primary hover:bg-primary/90"
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
      </Button>
      <Button
        size="icon"
        variant="outline"
        onClick={onSeekForward}
        disabled={disabled}
        className="h-8 w-8 bg-transparent"
      >
        <SkipForward className="h-4 w-4" />
      </Button>
    </div>
  )
}
