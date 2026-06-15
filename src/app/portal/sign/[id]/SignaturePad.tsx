"use client"

import { useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import SignatureCanvas from "react-signature-canvas"
import { portalSignAgreement } from "@/app/actions/portal"

export default function SignaturePad({ agreementId }: { agreementId: string }) {
  const padRef = useRef<SignatureCanvas>(null)
  const [empty, setEmpty] = useState(true)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const router = useRouter()

  function clear() {
    padRef.current?.clear()
    setEmpty(true)
  }

  function submit() {
    if (!padRef.current || padRef.current.isEmpty()) return
    const dataUrl = padRef.current.toDataURL("image/png")
    setError("")

    startTransition(async () => {
      const res = await portalSignAgreement(agreementId, dataUrl)
      if ("error" in res) { setError(res.error); return }
      setDone(true)
      setTimeout(() => router.push("/portal/dashboard"), 2000)
    })
  }

  if (done) {
    return (
      <div className="bg-success/10 border border-success/30 rounded-lg p-6 text-center space-y-2">
        <p className="text-success font-semibold">Document signed successfully!</p>
        <p className="text-sm text-muted">Redirecting to your dashboard…</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-secondary-soft p-6 space-y-4">
      <div>
        <p className="text-sm font-medium text-ink mb-1">Sign below</p>
        <p className="text-xs text-muted">Draw your signature in the box below using your mouse or finger.</p>
      </div>

      <div className="border-2 border-secondary-soft rounded-lg overflow-hidden bg-canvas">
        <SignatureCanvas
          ref={padRef}
          penColor="#2B2620"
          canvasProps={{
            className: "w-full",
            style: { height: 160, display: "block" },
          }}
          onBegin={() => setEmpty(false)}
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={clear}
          disabled={pending}
          className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink hover:border-secondary transition-colors"
        >
          Clear
        </button>
        <button
          onClick={submit}
          disabled={pending || empty}
          className="px-6 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Sign Document"}
        </button>
      </div>

      <p className="text-xs text-muted">
        By clicking &ldquo;Sign Document,&rdquo; you agree that your electronic signature is the legal equivalent of your handwritten signature on this document.
      </p>
    </div>
  )
}
