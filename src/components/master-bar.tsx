import { useEffect, useState } from "react"
import { Volume2, Activity } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { getAudioEngine } from "@/lib/audio-context"

interface MasterBarProps {
  crossfader: number
  onCrossfaderChange: (value: number) => void
  masterVolume: number
  onMasterVolumeChange: (value: number) => void
}

export function MasterBar({ crossfader, onCrossfaderChange, masterVolume, onMasterVolumeChange }: MasterBarProps) {
  const [meterData, setMeterData] = useState({ peak: 0, rms: 0 })

  useEffect(() => {
    const engine = getAudioEngine()

    const updateMeter = () => {
      const data = engine.getMasterMeterData()
      setMeterData(data)
      requestAnimationFrame(updateMeter)
    }

    const frameId = requestAnimationFrame(updateMeter)
    return () => cancelAnimationFrame(frameId)
  }, [])

  return (
    <div className="rounded-lg border-2 border-primary/50 bg-card p-4">
      <div className="flex items-center gap-6">
        {/* Crossfader */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-muted-foreground">CROSSFADER</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold font-mono text-primary">
                {Math.round(crossfader * 100)}%
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {crossfader === 0.5
                  ? "(CENTER)"
                  : crossfader < 0.5
                    ? `(A ${Math.round((0.5 - crossfader) * 200)}%)`
                    : `(B ${Math.round((crossfader - 0.5) * 200)}%)`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-chart-2">A</span>
            <Slider
              value={[crossfader * 100]}
              onValueChange={(values) => onCrossfaderChange(values[0] / 100)}
              max={100}
              step={0.1}
              className="flex-1"
              aria-label="Crossfader"
            />
            <span className="text-sm font-bold text-chart-4">B</span>
          </div>
        </div>

        {/* Master Volume */}
        <div className="flex items-center gap-3 w-64">
          <Volume2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground w-12">Master</span>
          <Slider
            value={[masterVolume * 100]}
            onValueChange={(values) => onMasterVolumeChange(values[0] / 100)}
            max={100}
            step={1}
            className="flex-1"
            aria-label="Master volume"
          />
          <span className="text-xs font-mono text-muted-foreground w-8 text-right">
            {Math.round(masterVolume * 100)}
          </span>
        </div>

        {/* Master Meter */}
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col gap-1 w-24">
            <div className="h-2 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
                style={{ width: `${Math.min(100, meterData.peak * 100)}%` }}
              />
            </div>
            <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-100"
                style={{ width: `${Math.min(100, meterData.rms * 150)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
