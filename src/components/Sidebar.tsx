import { signOut } from "@/auth"
import { can, type Role } from "@/lib/rbac"
import { NavLink } from "./NavLink"

const NAV = [
  { href: "/dashboard",   label: "Dashboard",   icon: "dashboard" },
  { href: "/clients",     label: "Clients",      icon: "clients" },
  { href: "/disputes",    label: "Disputes",     icon: "disputes" },
  { href: "/letters",     label: "Letters",      icon: "letters" },
  { href: "/reports",     label: "Reports",      icon: "reports" },
  { href: "/loans",       label: "Loans",        icon: "loans" },
  { href: "/lenders",     label: "Lenders",      icon: "lenders" },
  { href: "/tradelines",  label: "Tradelines",   icon: "tradelines" },
  { href: "/automations", label: "Automations",  icon: "automations" },
  { href: "/affiliates",  label: "Affiliates",   icon: "affiliates" },
]

const SETTINGS_NAV = [
  { href: "/settings/organization", label: "Organization", icon: "settings" },
  { href: "/settings/users",        label: "Users",        icon: "users" },
  { href: "/settings/templates",    label: "Templates",    icon: "templates" },
  { href: "/settings/audit-log",    label: "Audit Log",    icon: "audit-log" },
]

export default function Sidebar({
  userName,
  userRole,
  overdueCount = 0,
}: {
  userName: string
  userRole: Role
  overdueCount?: number
}) {
  const showSettings = can(userRole, "settings:write")
  const initials = userName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()

  return (
    <aside className="w-56 shrink-0 min-h-screen bg-white border-r border-secondary-soft flex flex-col">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-secondary-soft/60 h-12 flex items-center">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">O</span>
          </div>
          <div>
            <div>
              <span className="text-sm font-bold text-primary">one</span>
              <span className="text-sm font-semibold text-ink"> Consulting</span>
            </div>
            <div className="text-[8px] tracking-[0.3em] text-muted uppercase leading-none">Business</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map(item => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            badge={item.href === "/disputes" && overdueCount > 0 ? overdueCount : undefined}
          />
        ))}

        {showSettings && (
          <>
            <div className="pt-4 pb-1.5 px-2">
              <p className="text-[10px] text-muted font-semibold uppercase tracking-widest">Settings</p>
            </div>
            {SETTINGS_NAV.map(item => (
              <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-3 border-t border-secondary-soft">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-secondary-soft/40 transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-xs font-semibold text-primary">{initials || "?"}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">{userName}</p>
            <p className="text-[10px] text-muted">{userRole.replace("_", " ")}</p>
          </div>
          <form
            action={async () => {
              "use server"
              await signOut({ redirectTo: "/login" })
            }}
          >
            <button
              type="submit"
              title="Sign out"
              className="text-muted hover:text-danger transition-colors p-1"
            >
              {/* logout arrow icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
