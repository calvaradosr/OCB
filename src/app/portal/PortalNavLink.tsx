"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function PortalNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-secondary-soft text-primary"
          : "text-muted hover:text-ink hover:bg-secondary-soft/50"
      }`}
    >
      {label}
    </Link>
  )
}
