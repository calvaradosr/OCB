"use client"
import { useRef, useState } from "react"
import { DOCUMENT_CATEGORIES, DOCUMENT_CATEGORY_LABELS, formatFileSize } from "@/lib/client-utils"
import { getUploadUrl, registerDocument } from "@/app/actions/documents"

export function DocumentUpload({ clientId, onUploaded }: { clientId: string; onUploaded?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [category, setCategory] = useState<string>(DOCUMENT_CATEGORIES[0])
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle")
  const [error, setError] = useState("")
  const [progress, setProgress] = useState(0)

  async function handleFile(file: File) {
    setStatus("uploading")
    setError("")
    setProgress(10)

    // 1. Get presigned URL from server
    const result = await getUploadUrl(clientId, category as typeof DOCUMENT_CATEGORIES[number], file.name, file.type)

    if ("error" in result) {
      setError(result.error)
      setStatus("error")
      return
    }

    setProgress(30)

    // 2. PUT file directly to S3
    try {
      const s3Res = await fetch(result.presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status}`)
    } catch (e) {
      setError((e as Error).message)
      setStatus("error")
      return
    }

    setProgress(80)

    // 3. Register the document in the database
    const reg = await registerDocument(clientId, {
      s3Key: result.s3Key,
      fileName: file.name,
      category,
      fileSize: file.size,
      contentType: file.type,
    })

    if ("error" in reg) {
      setError(reg.error)
      setStatus("error")
      return
    }

    setProgress(100)
    setStatus("done")
    onUploaded?.()

    // Reset after a moment
    setTimeout(() => {
      setStatus("idle")
      setProgress(0)
      if (fileRef.current) fileRef.current.value = ""
    }, 2000)
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded-lg border border-secondary-soft px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {DOCUMENT_CATEGORIES.map(c => (
            <option key={c} value={c}>
              {DOCUMENT_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>

        <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-dashed border-secondary px-4 py-2 text-sm text-primary hover:bg-secondary-soft transition-colors">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          {status === "uploading" ? `Uploading… ${progress}%` : "Choose file"}
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            disabled={status === "uploading"}
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />
        </label>
      </div>

      {status === "error" && (
        <p className="text-sm text-danger">{error}</p>
      )}
      {status === "done" && (
        <p className="text-sm text-success">Document uploaded successfully.</p>
      )}
    </div>
  )
}
