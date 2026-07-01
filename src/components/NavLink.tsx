"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useRef, useState } from "react"
import {
  LayoutDashboard, Users, FileText, Mail, Briefcase,
  Building2, CreditCard, Zap, Users2, Settings,
  ClipboardList, ScrollText, BarChart2, FileEdit,
} from "lucide-react"

const ICONS: Record<string, React.ElementType> = {
  dashboard:   LayoutDashboard,
  clients:     Users,
  disputes:    FileText,
  letters:     Mail,
  reports:     BarChart2,
  loans:       Briefcase,
  lenders:     Building2,
  tradelines:  CreditCard,
  automations: Zap,
  affiliates:  Users2,
  settings:    Settings,
  users:       ClipboardList,
  templates:   FileEdit,
  "audit-log": ScrollText,
}

export function NavLink({
  href,
  label,
  icon,
  badge,
  hint,
}: {
  href: string
  label: string
  icon?: string
  badge?: number
  /** Optional hover tooltip — a familiarity bridge for CreditRepairCloud
   * migrants (e.g. "Same as Disputes in CRC"). Rendered as a fixed-positioned
   * popover so the sidebar's overflow-y-auto can't clip it. */
  hint?: string
}) {
  const pathname = usePathname()
  const active =
    pathname === href ||
    (href !== "/dashboard" && href !== "/settings" && pathname.startsWith(href + "/")) ||
    (href === "/settings" && pathname === "/settings")

  const Icon = icon ? ICONS[icon] : null

  const anchorRef = useRef<HTMLAnchorElement>(null)
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null)

  const showTip = () => {
    if (!hint) return
    const r = anchorRef.current?.getBoundingClientRect()
    if (r) setTip({ top: r.top + r.height / 2, left: r.right + 8 })
  }
  const hideTip = () => setTip(null)

  return (
    <>
      <Link
        ref={anchorRef}
        href={href}
        onMouseEnter={showTip}
        onMouseLeave={hideTip}
        onFocus={showTip}
        onBlur={hideTip}
        aria-label={hint ? `${label} — ${hint}` : undefined}
        className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-all ${
          active
            ? "bg-primary/10 text-primary font-medium border border-primary/20"
            : "text-muted hover:bg-secondary-soft/60 hover:text-ink border border-transparent"
        }`}
      >
        {Icon && <Icon size={14} strokeWidth={active ? 2.2 : 1.8} className={active ? "text-primary" : "text-muted"} />}
        <span className="flex-1">{label}</span>
        {badge != null && badge > 0 && (
          <span className="text-[10px] font-bold bg-danger text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </Link>
      {hint && tip && (
        <div
          role="tooltip"
          style={{ position: "fixed", top: tip.top, left: tip.left, transform: "translateY(-50%)" }}
          className="z-50 pointer-events-none whitespace-nowrap rounded-md bg-ink px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
        >
          {hint}
        </div>
      )}
    </>
  )
}
