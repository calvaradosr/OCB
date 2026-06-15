"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { getLoanUploadUrl, registerLoanDocument } from "@/app/actions/loans"

export default function LoanDocUpload({ loanFileId, category }: { loanFileId: string; category: string }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle")
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function handleFile(file: File) {
    setStatus("uploading")
    setError("")

    const result = await getLoanUploadUrl(loanFileId, category, file.name, file.type)
    if ("error" in result) { setError(result.error); setStatus("error"); return }

    try {
      const res = await fetch(result.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!res.ok) throw new Error(`S3 upload failed: ${res.status}`)
    } catch (e) {
      setError((e as Error).message); setStatus("error"); return
    }

    startTransition(async () => {
      const reg = await registerLoanDocument({
        loanFileId,
        category,
        s3Key: result.s3Key,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
      })
      if ("error" in reg) { setError(reg.error); setStatus("error"); return }
      setStatus("done")
      router.refresh()
      setTimeout(() => setStatus("idle"), 2000)
    })
  }

  if (status === "uploading" || pending) return <span className="text-xs text-muted shrink-0">Uploading…</span>
  if (status === "done") return <span className="text-xs text-success shrink-0">Uploaded</span>
  if (status === "error") return <span className="text-xs text-danger shrink-0">{error}</span>

  return (
    <label className="shrink-0 cursor-pointer inline-flex items-center gap-1 text-xs text-primary hover:underline">
      Upload
      <input
        ref={fileRef}
        type="file"
        className="sr-only"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </label>
  )
}
