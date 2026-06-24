"use client"

type ReportPoint = {
  pulledAt: Date | string
  scoreExperian: number | null
  scoreEquifax: number | null
  scoreTransunion: number | null
}

type Props = {
  reports: ReportPoint[]
}

const SERIES = [
  { key: "scoreTransunion" as const, label: "TU", color: "#27AE60" },
  { key: "scoreExperian" as const, label: "EXP", color: "#E74C3C" },
  { key: "scoreEquifax" as const, label: "EQF", color: "#2980B9" },
]

const W = 560
const H = 160
const PAD = { top: 12, right: 12, bottom: 32, left: 44 }
const IW = W - PAD.left - PAD.right
const IH = H - PAD.top - PAD.bottom

export function ScoreChart({ reports }: Props) {
  if (reports.length < 2) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-muted/60">
        Import at least 2 reports to see score trend
      </div>
    )
  }

  const sorted = [...reports].sort(
    (a, b) => new Date(a.pulledAt).getTime() - new Date(b.pulledAt).getTime()
  )

  const allScores = sorted.flatMap(r =>
    SERIES.map(s => r[s.key]).filter((v): v is number => v != null)
  )
  const minScore = Math.max(300, Math.min(...allScores) - 20)
  const maxScore = Math.min(850, Math.max(...allScores) + 20)
  const range = maxScore - minScore

  function xPos(i: number) {
    return PAD.left + (i / (sorted.length - 1)) * IW
  }
  function yPos(score: number) {
    return PAD.top + IH - ((score - minScore) / range) * IH
  }

  const yTicks = 4
  const yStep = Math.round(range / yTicks / 10) * 10

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: 280, maxWidth: W }}
      >
        {/* Y grid lines + labels */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const score = Math.round(minScore + i * yStep)
          const y = yPos(score)
          return (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y}
                y2={y}
                stroke="#e8eaed"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y + 4}
                fontSize={10}
                fill="#9ca3af"
                textAnchor="end"
              >
                {score}
              </text>
            </g>
          )
        })}

        {/* X date labels */}
        {sorted.map((r, i) => {
          if (sorted.length > 6 && i % 2 !== 0 && i !== sorted.length - 1) return null
          const date = new Date(r.pulledAt)
          return (
            <text
              key={i}
              x={xPos(i)}
              y={H - 4}
              fontSize={9}
              fill="#9ca3af"
              textAnchor="middle"
            >
              {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </text>
          )
        })}

        {/* Lines + dots per series */}
        {SERIES.map(series => {
          const points = sorted
            .map((r, i) => {
              const score = r[series.key]
              return score != null ? { x: xPos(i), y: yPos(score), score } : null
            })
            .filter((p): p is NonNullable<typeof p> => p !== null)

          if (points.length < 2) return null

          const d = points
            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
            .join(" ")

          return (
            <g key={series.key}>
              <path
                d={d}
                stroke={series.color}
                strokeWidth={2}
                fill="none"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill={series.color} />
              ))}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 mt-1 justify-center">
        {SERIES.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 rounded-full inline-block" style={{ backgroundColor: s.color }} />
            <span className="text-xs text-muted">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
