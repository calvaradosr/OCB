"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS = [
  { label: "Overview",    suffix: "",            icon: "○" },
  { label: "Reports",     suffix: "/reports",    icon: "📄" },
  { label: "Disputes",    suffix: "/disputes",   icon: "⚖" },
  { label: "Messages",    suffix: "/messages",   icon: "✉" },
  { label: "Agreements",  suffix: "/agreements", icon: "✍" },
  { label: "Billing",     suffix: "/billing",    icon: "$" },
  { label: "Tradelines",  suffix: "/tradelines", icon: "💳" },
]

export function ClientTabBar({ clientId }: { clientId: string }) {
  const pathname = usePathname()
  const base = `/clients/${clientId}`

  return (
    <div className="flex gap-0.5 border-b border-secondary-soft overflow-x-auto -mb-px">
      {TABS.map(tab => {
        const href = base + tab.suffix
        const active =
          tab.suffix === ""
            ? pathname === base
            : pathname.startsWith(href)

        return (
          <Link
            key={tab.suffix}
            href={href}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors ${
              active
                ? "border-primary text-primary font-medium"
                : "border-transparent text-muted hover:text-ink hover:border-secondary"
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
