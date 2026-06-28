"use client"

import { useState, useTransition, useEffect } from "react"
import { getTemplateBody, saveTemplate, resetTemplate } from "@/app/actions/templates"

const MERGE_FIELDS = [
  { field: "{{date}}", desc: "Today's date" },
  { field: "{{client.firstName}}", desc: "Client first name" },
  { field: "{{client.lastName}}", desc: "Client last name" },
  { field: "{{client.addressLine1}}", desc: "Client address" },
  { field: "{{client.city}}", desc: "Client city" },
  { field: "{{client.state}}", desc: "Client state" },
  { field: "{{client.zip}}", desc: "Client ZIP" },
  { field: "{{bureau.name}}", desc: "Bureau name (EXP/EQF/TU)" },
  { field: "{{bureau.address}}", desc: "Bureau mailing address" },
  { field: "{{#each items}}...{{/each}}", desc: "Loop over blocked accounts" },
  { field: "{{creditorName}}", desc: "Account creditor (inside each)" },
  { field: "{{accountNumberMasked}}", desc: "Masked account # (inside each)" },
  { field: "{{reason}}", desc: "Block reason (inside each)" },
]

export function TemplateEditor({
  templateId,
  label,
  hasCustom,
}: {
  templateId: string
  label: string
  hasCustom: boolean
}) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState("")
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [isCustom, setIsCustom] = useState(hasCustom)
  const [pending, startTransition] = useTransition()

  function handleOpen() {
    if (!loaded) {
      startTransition(async () => {
        const text = await getTemplateBody(templateId)
        setBody(text)
        setLoaded(true)
      })
    }
    setOpen(true)
  }

  function handleSave() {
    setSaved(false)
    startTransition(async () => {
      await saveTemplate(templateId, body)
      setSaved(true)
      setIsCustom(true)
    })
  }

  function handleReset() {
    if (!confirm("Reset to the default template? Your customizations will be discarded.")) return
    startTransition(async () => {
      const res = await resetTemplate(templateId)
      if ("ok" in res) {
        const text = await getTemplateBody(templateId)
        setBody(text)
        setIsCustom(false)
        setSaved(false)
      }
    })
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-xs text-primary hover:underline"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 pb-4 overflow-y-auto">
          <div className="bg-white rounded-xl border border-secondary-soft shadow-xl w-full max-w-4xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-secondary-soft">
              <div>
                <h2 className="text-base font-semibold text-ink">{label}</h2>
                {isCustom && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium ml-2">
                    Customized
                  </span>
                )}
              </div>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-ink">✕</button>
            </div>

            <div className="grid grid-cols-3 gap-0 divide-x divide-secondary-soft">
              {/* Editor */}
              <div className="col-span-2 p-5 space-y-3">
                <p className="text-xs text-muted">
                  Edit the letter body. Use merge fields on the right to personalize content.
                  All letter text must comply with CROA — no guaranteed outcome language.
                </p>
                <textarea
                  value={pending && !loaded ? "Loading…" : body}
                  onChange={e => setBody(e.target.value)}
                  disabled={pending}
                  rows={22}
                  className="w-full rounded-lg border border-secondary-soft px-3 py-2.5 text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Merge fields reference */}
              <div className="p-5 space-y-3">
                <p className="text-xs font-semibold text-muted uppercase tracking-widest">Merge Fields</p>
                <div className="space-y-2">
                  {MERGE_FIELDS.map(f => (
                    <div key={f.field} className="group">
                      <code className="text-[10px] text-primary bg-primary/5 px-1.5 py-0.5 rounded font-mono block">
                        {f.field}
                      </code>
                      <p className="text-[10px] text-muted mt-0.5 pl-0.5">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between px-6 py-4 border-t border-secondary-soft">
              <div className="flex gap-2">
                {isCustom && (
                  <button
                    onClick={handleReset}
                    disabled={pending}
                    className="px-4 py-2 rounded-lg border border-secondary-soft text-xs text-muted hover:text-danger hover:border-danger/30 transition-colors disabled:opacity-50"
                  >
                    Reset to default
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                {saved && <span className="text-xs text-success font-medium">Saved!</span>}
                <button onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={pending}
                  className="px-5 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors"
                >
                  {pending ? "Saving…" : "Save template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
