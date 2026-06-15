import { auth } from "@/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { signOut } from "@/auth"
import PortalNavLink from "./PortalNavLink"

const NAV = [
  { href: "/portal/dashboard", label: "My Progress" },
  { href: "/portal/documents", label: "Documents" },
  { href: "/portal/loans", label: "Loan Status" },
  { href: "/portal/tradelines", label: "Tradelines" },
  { href: "/portal/messages", label: "Messages" },
  { href: "/portal/billing", label: "Billing" },
]

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session) redirect("/login")
  if (session.user.role !== "CLIENT") redirect("/dashboard")

  return (
    <div className="min-h-screen bg-canvas">
      <header className="bg-white border-b border-secondary-soft">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/portal/dashboard" className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-primary">one</span>
            <span className="text-xl font-semibold text-ink"> Consulting</span>
            <span className="text-xs tracking-[0.25em] text-secondary uppercase ml-1">Business</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map(item => (
              <PortalNavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">{session.user.name}</span>
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}
