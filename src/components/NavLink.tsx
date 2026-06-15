"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

export function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href || pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? "bg-secondary-soft text-primary-dark font-medium"
          : "text-ink hover:bg-secondary-soft hover:text-primary-dark"
      }`}
    >
      {label}
    </Link>
  )
}
