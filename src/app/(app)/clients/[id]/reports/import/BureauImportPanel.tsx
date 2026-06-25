"use client"

import { useState, useTransition, useCallback, useEffect, useRef } from "react"
import {
  saveBureauCredential,
  deleteBureauCredential,
  getBureauCredentials,
  triggerReportFetch,
  type BureauCredentialPublic,
} from "@/app/actions/bureau-creds"
import type { BureauService } from "@prisma/client"

// ─── Service config ───────────────────────────────────────────────────────────

type ServiceConfig = {
  key: BureauService
  label: string
  initials: string
  bgColor: string
  textColor: string
  description: string
}

const SERVICES: ServiceConfig[] = [
  {
    key: "IDENTITY_IQ",
    label: "IdentityIQ",
    initials: "IIQ",
    bgColor: "bg-primary",
    textColor: "text-white",
    description: "3-bureau monitoring",
  },
  {
    key: "MY_SCORE_360",
    label: "MyScore360",
    initials: "MS",
    bgColor: "bg-success",
    textColor: "text-white",
    description: "Score monitoring",
  },
  {
    key: "EXPERIAN",
    label: "Experian",
    initials: "EXP",
    bgColor: "bg-danger",
    textColor: "text-white",
    description: "Experian direct",
  },
  {
    key: "EQUIFAX",
    label: "Equifax",
    initials: "EQF",
    bgColor: "bg-primary",
    textColor: "text-white",
    description: "Equifax direct",
  },
  {
    key: "TRANSUNION",
    label: "TransUnion",
    initials: "TU",
    bgColor: "bg-cyan-700",
    textColor: "text-white",
    description: "TransUnion direct",
  },
  {
    key: "ANNUAL_CREDIT_REPORT",
    label: "AnnualCreditReport",
    initials: "ACR",
    bgColor: "bg-violet-600",
    textColor: "text-white",
    description: "Free annual report",
  },
]

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null

  const styles: Record<string, string> = {
    success: "bg-success/10 text-success",
    failed: "bg-danger/10 text-danger",
    pending: "bg-warning/10 text-warning",
    captcha: "bg-warning/10 text-warning",
    mfa_required: "bg-warning/10 text-warning",
  }
  const labels: Record<string, string> = {
    success: "Success",
    failed: "Failed",
    pending: "Fetching…",
    captcha: "CAPTCHA",
    mfa_required: "MFA Required",
  }

  const cls = styles[status] ?? "bg-secondary-soft text-muted"
  const label = labels[status] ?? status

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {status === "pending" && (
        <span className="inline-block w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {label}
    </span>
  )
}

// ─── Credential form ──────────────────────────────────────────────────────────

function CredentialForm({
  clientId,
  service,
  existingUsername,
  onSaved,
  onCancel,
}: {
  clientId: string
  service: BureauService
  existingUsername?: string
  onSaved: () => void
  onCancel: () => void
}) {
  const [username, setUsername] = useState(existingUsername ?? "")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError("")
    startTransition(async () => {
      const result = await saveBureauCredential(clientId, service, username, password)
      if ("error" in result) {
        setError(result.error)
        return
      }
      onSaved()
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-secondary-soft space-y-2">
      <div>
        <label className="block text-xs text-muted mb-0.5">Username / Email</label>
        <input
          type="text"
          value={username}
          onChange={e => setUsername(e.target.value)}
          placeholder="Enter login email or username"
          autoComplete="off"
          className="w-full text-sm border border-secondary-soft rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div>
        <label className="block text-xs text-muted mb-0.5">Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder={existingUsername ? "Leave blank to keep existing" : "Enter password"}
          autoComplete="new-password"
          className="w-full text-sm border border-secondary-soft rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isPending || !username.trim() || (!existingUsername && !password.trim())}
          className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-secondary-soft rounded text-muted hover:bg-secondary-soft/30 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Single service card ──────────────────────────────────────────────────────

function ServiceCard({
  config,
  cred,
  clientId,
  isFetching,
  onRefresh,
}: {
  config: ServiceConfig
  cred: BureauCredentialPublic | undefined
  clientId: string
  isFetching: boolean
  onRefresh: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [fetchError, setFetchError] = useState("")
  const [isFetchPending, startFetchTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()

  function handleFetch() {
    if (!cred) return
    setFetchError("")
    startFetchTransition(async () => {
      const result = await triggerReportFetch(clientId, cred.id)
      if ("error" in result) {
        setFetchError(result.error)
        return
      }
      // Start polling for status update
      onRefresh()
    })
  }

  function handleDelete() {
    if (!cred) return
    if (!confirm(`Remove ${config.label} credentials? This cannot be undone.`)) return
    startDeleteTransition(async () => {
      await deleteBureauCredential(cred.id)
      onRefresh()
    })
  }

  const isPending = isFetching || isFetchPending
  const maskedUsername = cred
    ? cred.username.length > 4
      ? `${cred.username.slice(0, 3)}${"•".repeat(Math.min(cred.username.length - 3, 8))}`
      : cred.username
    : null

  return (
    <div className={`bg-white border rounded-xl p-4 transition-all ${
      cred ? "border-secondary-soft" : "border-dashed border-secondary-soft opacity-80"
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${config.bgColor} ${config.textColor}`}>
          {config.initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-ink text-sm">{config.label}</p>
            {cred && <StatusBadge status={isPending ? "pending" : cred.lastStatus} />}
          </div>
          <p className="text-xs text-muted">{config.description}</p>
          {cred && (
            <div className="mt-1 text-xs text-muted space-y-0.5">
              <p>User: <span className="font-mono text-ink">{maskedUsername}</span></p>
              {cred.lastFetchAt && (
                <p>
                  Last fetch:{" "}
                  {new Date(cred.lastFetchAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {cred.lastError && cred.lastStatus !== "success" && (
                <p className="text-danger text-xs truncate" title={cred.lastError}>
                  {cred.lastError.slice(0, 80)}{cred.lastError.length > 80 ? "…" : ""}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      {!showForm && (
        <div className="mt-3 flex flex-wrap gap-2">
          {cred ? (
            <>
              <button
                onClick={handleFetch}
                disabled={isPending}
                className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {isPending && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {isPending ? "Fetching…" : "Fetch Now"}
              </button>
              <button
                onClick={() => setShowForm(true)}
                className="px-3 py-1.5 text-xs border border-secondary-soft rounded-lg text-muted hover:bg-secondary-soft/30 transition-colors"
              >
                Update
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeletePending}
                className="px-3 py-1.5 text-xs border border-danger/30 text-danger rounded-lg hover:bg-danger/5 disabled:opacity-50 transition-colors"
              >
                Remove
              </button>
            </>
          ) : (
            <button
              onClick={() => setShowForm(true)}
              className="px-3 py-1.5 text-xs border border-secondary-soft rounded-lg text-muted hover:bg-secondary-soft/30 hover:text-ink transition-colors"
            >
              + Add Login
            </button>
          )}
        </div>
      )}

      {fetchError && <p className="mt-2 text-xs text-danger">{fetchError}</p>}

      {/* Inline credential form */}
      {showForm && (
        <CredentialForm
          clientId={clientId}
          service={config.key}
          existingUsername={cred?.username}
          onSaved={() => {
            setShowForm(false)
            onRefresh()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function BureauImportPanel({
  clientId,
  initialCreds,
}: {
  clientId: string
  initialCreds: BureauCredentialPublic[]
}) {
  const [creds, setCreds] = useState<BureauCredentialPublic[]>(initialCreds)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    const updated = await getBureauCredentials(clientId)
    setCreds(updated)
  }, [clientId])

  // Poll every 3 seconds while any credential is in "pending" state
  useEffect(() => {
    const hasPending = creds.some(c => c.lastStatus === "pending")
    if (hasPending && !pollingRef.current) {
      pollingRef.current = setInterval(() => {
        refresh().catch(() => {})
      }, 3_000)
    } else if (!hasPending && pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [creds, refresh])

  const credMap = new Map(creds.map(c => [c.service, c]))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-ink">Bureau Auto-Import</h2>
          <p className="text-sm text-muted mt-0.5">
            Store login credentials for bureau monitoring services. Click &quot;Fetch Now&quot; to automatically pull a 3-bureau report.
          </p>
        </div>
        <span className="text-xs text-muted bg-secondary-soft px-2 py-1 rounded-full">
          {creds.length} of {SERVICES.length} connected
        </span>
      </div>

      <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 text-xs text-warning space-y-1">
        <p className="font-medium">Security notice</p>
        <p>Credentials are encrypted with AES-256-GCM and never stored in plaintext. Bureau automation runs server-side in a headless browser. CAPTCHA and MFA-protected accounts cannot be automated.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SERVICES.map(config => (
          <ServiceCard
            key={config.key}
            config={config}
            cred={credMap.get(config.key)}
            clientId={clientId}
            isFetching={credMap.get(config.key)?.lastStatus === "pending"}
            onRefresh={refresh}
          />
        ))}
      </div>
    </div>
  )
}
