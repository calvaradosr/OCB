"use client"

import { useState } from "react"

export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted">
      <span>Referral link:</span>
      <span className="font-mono bg-secondary-soft px-2 py-0.5 rounded text-ink truncate max-w-[260px]">{url}</span>
      <button onClick={copy} className="text-primary hover:underline shrink-0">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  )
}
