"use client"

import { useEffect, useRef } from "react"

type DataPoint = {
  date: string
  experian: number | null
  equifax: number | null
  transunion: number | null
}

export default function ScoreTrendChart({ data }: { data: DataPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const PAD = { top: 16, right: 16, bottom: 32, left: 44 }
    const chartW = W - PAD.left - PAD.right
    const chartH = H - PAD.top - PAD.bottom

    const allScores = data.flatMap(d => [d.experian, d.equifax, d.transunion]).filter(Boolean) as number[]
    const minScore = Math.min(...allScores, 300) - 20
    const maxScore = Math.max(...allScores, 850) + 20

    const toX = (i: number) => PAD.left + (i / (data.length - 1)) * chartW
    const toY = (score: number) => PAD.top + chartH - ((score - minScore) / (maxScore - minScore)) * chartH

    ctx.clearRect(0, 0, W, H)

    // Grid lines
    ctx.strokeStyle = "#F3E8C8"
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = PAD.top + (i / 4) * chartH
      ctx.beginPath()
      ctx.moveTo(PAD.left, y)
      ctx.lineTo(W - PAD.right, y)
      ctx.stroke()
      const label = Math.round(maxScore - (i / 4) * (maxScore - minScore))
      ctx.fillStyle = "#7A6F5C"
      ctx.font = "10px Inter, sans-serif"
      ctx.textAlign = "right"
      ctx.fillText(String(label), PAD.left - 6, y + 4)
    }

    // Date labels
    ctx.fillStyle = "#7A6F5C"
    ctx.font = "10px Inter, sans-serif"
    ctx.textAlign = "center"
    data.forEach((d, i) => {
      ctx.fillText(d.date.slice(5), toX(i), H - 8)
    })

    const SERIES = [
      { key: "transunion" as const, color: "#C77B22" },
      { key: "experian" as const, color: "#A8862B" },
      { key: "equifax" as const, color: "#3E7C4A" },
    ]

    SERIES.forEach(({ key, color }) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      let started = false
      data.forEach((d, i) => {
        const score = d[key]
        if (score == null) return
        const x = toX(i)
        const y = toY(score)
        if (!started) { ctx.moveTo(x, y); started = true } else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // Dots
      data.forEach((d, i) => {
        const score = d[key]
        if (score == null) return
        ctx.beginPath()
        ctx.arc(toX(i), toY(score), 3, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.fill()
      })
    })

    // Legend
    const LABELS = ["TransUnion", "Experian", "Equifax"]
    SERIES.forEach(({ color }, i) => {
      const lx = PAD.left + i * 100
      const ly = H - 4
      ctx.fillStyle = color
      ctx.fillRect(lx, ly - 6, 14, 4)
      ctx.fillStyle = "#7A6F5C"
      ctx.font = "10px Inter, sans-serif"
      ctx.textAlign = "left"
      ctx.fillText(LABELS[i], lx + 18, ly)
    })
  }, [data])

  return <canvas ref={canvasRef} width={700} height={220} className="w-full" />
}
