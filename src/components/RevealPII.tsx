"use client"
import { useState, useTransition } from "react"
import { revealPII } from "@/app/actions/clients"

export function RevealPII({
  clientId,
  field,
  placeholder = "●●●–●●–●●●●",
}: {
  clientId: string
  field: "ssn" | "dob" | "coAppSsn" | "coAppDob"
  placeholder?: string
}) {
  const [value, setValue] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reveal() {
    startTransition(async () => {
      const result = await revealPII(clientId, field)
      if (result?.value) setValue(result.value)
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-sm text-ink">{value ?? placeholder}</span>
      {!value && (
        <button
          onClick={reveal}
          disabled={isPending}
          className="text-xs text-primary hover:text-primary-dark underline disabled:opacity-50"
        >
          {isPending ? "…" : "Reveal"}
        </button>
      )}
    </span>
  )
}
