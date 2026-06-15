"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { DOCUMENT_CATEGORIES } from "@/lib/client-utils"
import { portalGetUploadUrl, portalRegisterDocument } from "@/app/actions/portal"

type Category = (typeof DOCUMENT_CATEGORIES)[number]

export default function PortalDocumentUpload({ category }: { category: Category }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle")
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)
  const router = useRouter()

  async function handleFile(file: File) {
    setStatus("uploading")
    setError("")
    setProgress(20)

    const result = await portalGetUploadUrl(category, file.name, file.type)
    if ("error" in result) { setError(result.error); setStatus("error"); return }

    setProgress(40)

    try {
      const s3Res = await fetch(result.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status}`)
    } catch (e) {
      setError((e as Error).message); setStatus("error"); return
    }

    setProgress(80)

    const reg = await portalRegisterDocument({
      s3Key: result.s3Key,
      fileName: file.name,
      category,
      fileSize: file.size,
      contentType: file.type,
    })

    if ("error" in reg) { setError(reg.error); setStatus("error"); return }

    setProgress(100)
    setStatus("done")
    router.refresh()
  }

  return (
    <div className="shrink-0">
      {status === "uploading" ? (
        <span className="text-xs text-muted">Uploading… {progress}%</span>
      ) : status === "error" ? (
        <span className="text-xs text-danger">{error}</span>
      ) : (
        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded border border-dashed border-secondary px-3 py-1.5 text-xs text-primary hover:bg-secondary-soft transition-colors">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Upload
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </label>
      )}
    </div>
  )
}
