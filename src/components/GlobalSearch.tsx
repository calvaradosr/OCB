"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"

type Result = {
  id: string
  type: "client" | "dispute" | "loan"
  title: string
  sub: string
  href: string
}

async function search(q: string): Promise<Result[]> {
  if (!q.trim()) return []
  const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
  if (!res.ok) return []
  return res.json()
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Result[]>([])
  const [selected, setSelected] = useState(0)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Reset transient palette state in the handler when opening (not in an effect)
  // so we don't trigger a synchronous setState-in-effect cascade.
  function openSearch() {
    setQuery("")
    setResults([])
    setSelected(0)
    setOpen(true)
  }

  // Cmd+K / Ctrl+K toggles the palette; Escape closes it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        if (open) {
          setOpen(false)
        } else {
          // Inline (not via openSearch) so the effect only closes over `open`
          // and the stable state setters — keeps the dep array exhaustive.
          setQuery("")
          setResults([])
          setSelected(0)
          setOpen(true)
        }
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  // Focus the input when the palette opens (no setState here).
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  // Debounced search. All state updates happen inside the timeout (async), so
  // there is no synchronous setState in the effect body.
  useEffect(() => {
    const q = query.trim()
    const timeout = setTimeout(() => {
      if (!q) {
        setResults([])
        setSelected(0)
        return
      }
      startTransition(async () => {
        const res = await search(q)
        setResults(res)
        setSelected(0)
      })
    }, 200)
    return () => clearTimeout(timeout)
  }, [query])

  function navigate(href: string) {
    router.push(href)
    setOpen(false)
    setQuery("")
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)) }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === "Enter" && results[selected]) navigate(results[selected].href)
  }

  const TYPE_LABELS: Record<string, string> = { client: "Client", dispute: "Dispute", loan: "Loan" }
  const TYPE_COLORS: Record<string, string> = {
    client: "bg-primary/10 text-primary",
    dispute: "bg-warning/10 text-warning",
    loan: "bg-success/10 text-success",
  }

  if (!open) {
    return (
      <button
        onClick={openSearch}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-secondary-soft text-sm text-muted hover:text-ink hover:border-primary/30 transition-all bg-white"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <span>Search…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono bg-secondary-soft px-1.5 py-0.5 rounded">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl border border-secondary-soft shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-secondary-soft">
          <svg className="w-4 h-4 text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search clients, disputes, loans…"
            className="flex-1 text-sm text-ink placeholder:text-muted bg-transparent focus:outline-none"
          />
          {isPending && (
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
          )}
          <kbd className="hidden sm:block text-[10px] font-mono text-muted bg-secondary-soft px-1.5 py-0.5 rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <ul className="py-2 max-h-80 overflow-y-auto">
            {results.map((r, i) => (
              <li key={r.id}>
                <button
                  onClick={() => navigate(r.href)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selected ? "bg-primary/5" : "hover:bg-secondary-soft/40"
                  }`}
                >
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide shrink-0 ${TYPE_COLORS[r.type] ?? ""}`}>
                    {TYPE_LABELS[r.type] ?? r.type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{r.title}</p>
                    {r.sub && <p className="text-xs text-muted truncate">{r.sub}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {query.trim() && !isPending && results.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted text-center">No results for &ldquo;{query}&rdquo;</p>
        )}

        {!query.trim() && (
          <div className="px-4 py-4 text-xs text-muted space-y-1">
            <p>Search across clients, disputes, and loans</p>
            <p>Use <kbd className="font-mono bg-secondary-soft px-1 rounded">↑↓</kbd> to navigate, <kbd className="font-mono bg-secondary-soft px-1 rounded">↵</kbd> to open</p>
          </div>
        )}
      </div>
    </div>
  )
}
