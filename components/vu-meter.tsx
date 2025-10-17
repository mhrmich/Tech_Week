"use client"

interface VUMeterProps {
  peak: number
  rms: number
}

export function VUMeter({ peak, rms }: VUMeterProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 transition-all duration-75"
          style={{ width: `${Math.min(100, peak * 100)}%` }}
        />
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/70 transition-all duration-100"
          style={{ width: `${Math.min(100, rms * 150)}%` }}
        />
      </div>
    </div>
  )
}
