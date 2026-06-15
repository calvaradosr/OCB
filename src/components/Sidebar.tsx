import { signOut } from "@/auth"
import type { Role } from "@/lib/rbac"
import { NavLink } from "./NavLink"

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clients", label: "Clients" },
  { href: "/disputes", label: "Disputes" },
  { href: "/letters", label: "Letters" },
  { href: "/loans", label: "Loans" },
  { href: "/lenders", label: "Lenders" },
  { href: "/tradelines", label: "Tradelines" },
  { href: "/automations", label: "Automations" },
  { href: "/affiliates", label: "Affiliates" },
]

export default function Sidebar({ userName, userRole }: { userName: string; userRole: Role }) {
  return (
    <aside className="w-60 shrink-0 min-h-screen bg-white border-r border-secondary-soft flex flex-col">
      <div className="px-6 py-5">
        <span className="text-xl font-bold text-primary">one</span>
        <span className="text-xl font-semibold text-ink"> Consulting</span>
        <div className="text-xs tracking-[0.25em] text-secondary uppercase">Business</div>
      </div>

      <nav className="flex-1 px-3 space-y-0.5">
        {NAV.map(item => (
          <NavLink key={item.href} href={item.href} label={item.label} />
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-secondary-soft">
        <p className="text-sm font-medium text-ink truncate">{userName}</p>
        <p className="text-xs text-muted mb-3">{userRole.replace("_", " ")}</p>
        <form
          action={async () => {
            "use server"
            await signOut({ redirectTo: "/login" })
          }}
        >
          <button type="submit" className="text-xs text-muted hover:text-danger transition-colors">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
