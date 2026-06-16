"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Users, FileText, Mail, Briefcase,
  Building2, CreditCard, Zap, Users2, Settings,
  ClipboardList, ScrollText,
} from "lucide-react"

const ICONS: Record<string, React.ElementType> = {
  dashboard:   LayoutDashboard,
  clients:     Users,
  disputes:    FileText,
  letters:     Mail,
  loans:       Briefcase,
  lenders:     Building2,
  tradelines:  CreditCard,
  automations: Zap,
  affiliates:  Users2,
  settings:    Settings,
  users:       ClipboardList,
  "audit-log": ScrollText,
}

export function NavLink({ href, label, icon }: { href: string; label: string; icon?: string }) {
  const pathname = usePathname()
  const active =
    pathname === href ||
    (href !== "/dashboard" && href !== "/settings" && pathname.startsWith(href + "/")) ||
    (href === "/settings" && pathname === "/settings")

  const Icon = icon ? ICONS[icon] : null

  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-all ${
        active
          ? "bg-primary/10 text-primary font-medium border border-primary/20"
          : "text-muted hover:bg-secondary-soft/60 hover:text-ink border border-transparent"
      }`}
    >
      {Icon && <Icon size={15} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-primary" : "text-muted"} />}
      {label}
    </Link>
  )
}
