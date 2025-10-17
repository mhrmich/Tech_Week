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

    peaks.forEach((peak, i) => {
      const barHeight = peak * height * 0.8
      const x = i * barWidth
      const y = (height - barHeight) / 2

      const isPast = i / peaks.length < progress

      ctx.fillStyle = isPast ? "oklch(0.75 0.15 195)" : "oklch(0.35 0.01 240)"

      ctx.fillRect(x, y, Math.max(barWidth - 1, 1), barHeight)
    })

    const progressX = progress * width
    ctx.strokeStyle = "oklch(0.95 0.01 240)"
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(progressX, 0)
    ctx.lineTo(progressX, height)
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
