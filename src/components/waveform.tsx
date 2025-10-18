import type React from "react"

import { useEffect, useRef } from "react"

interface WaveformProps {
  peaks: number[]
  currentTime: number
  duration: number
  onSeek: (time: number) => void
}

export function Waveform({ peaks, currentTime, duration, onSeek }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || peaks.length === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()

    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr

    ctx.scale(dpr, dpr)

    const width = rect.width
    const height = rect.height
    const barWidth = width / peaks.length
    const progress = duration > 0 ? currentTime / duration : 0

    ctx.clearRect(0, 0, width, height)

    // Draw waveform bars
    peaks.forEach((peak, i) => {
      const barHeight = peak * height * 0.8
      const x = i * barWidth
      const y = (height - barHeight) / 2

      const isPast = i / peaks.length < progress

      // Played portion: bright blue, unplayed: dark gray
      ctx.fillStyle = isPast ? "hsl(200, 80%, 60%)" : "hsl(220, 10%, 30%)"

      ctx.fillRect(x, y, Math.max(barWidth - 1, 1), barHeight)
    })

    // Draw progress overlay (gradient from left showing played portion)
    const progressX = progress * width
    const gradient = ctx.createLinearGradient(0, 0, progressX, 0)
    gradient.addColorStop(0, "rgba(59, 130, 246, 0.2)")
    gradient.addColorStop(1, "rgba(59, 130, 246, 0.4)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, progressX, height)

    // Draw playhead line (bright and thick)
    ctx.strokeStyle = "hsl(200, 100%, 70%)"
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(progressX, 0)
    ctx.lineTo(progressX, height)
    ctx.stroke()

    // Draw playhead circle at top
    ctx.fillStyle = "hsl(200, 100%, 70%)"
    ctx.beginPath()
    ctx.arc(progressX, 8, 6, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = "white"
    ctx.lineWidth = 2
    ctx.stroke()
  }, [peaks, currentTime, duration])

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const progress = x / rect.width
    const time = progress * duration

    onSeek(time)
  }

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-24 cursor-pointer rounded bg-secondary/30"
      onClick={handleClick}
      style={{ width: "100%", height: "96px" }}
    />
  )
}
