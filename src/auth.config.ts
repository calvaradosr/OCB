// Edge-compatible NextAuth config — NO Prisma imports.
// Used by middleware.ts for JWT validation on the Edge.
import type { NextAuthConfig } from "next-auth"
import type { Role } from "@/lib/rbac"

const STAFF_ROLES: Role[] = ["ADMIN", "MANAGER", "AGENT", "LOAN_PROCESSOR"]
const CLIENT_HOME = "/portal/dashboard"

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.mfaEnabled = user.mfaEnabled ?? false
        token.mfaVerified = user.mfaVerified ?? false
      }
      if (trigger === "update" && session?.user) {
        const u = session.user as Partial<{ mfaVerified: boolean; mfaEnabled: boolean }>
        if (u.mfaVerified !== undefined) token.mfaVerified = u.mfaVerified
        if (u.mfaEnabled !== undefined) token.mfaEnabled = u.mfaEnabled
      }
      return token
    },

    session({ session, token }) {
      session.user.id = (token.id as string) ?? ""
      session.user.role = (token.role as Role) ?? "CLIENT"
      session.user.mfaEnabled = (token.mfaEnabled as boolean) ?? false
      session.user.mfaVerified = (token.mfaVerified as boolean) ?? false
      return session
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth
      const pathname = nextUrl.pathname

      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl))
      }

      const { mfaEnabled, mfaVerified, role } = auth.user

      // CLIENT role: lives in /portal only
      if (role === "CLIENT") {
        if (pathname.startsWith("/portal") || pathname === "/login") return true
        return Response.redirect(new URL(CLIENT_HOME, nextUrl))
      }

      // MFA pending: user verified password but not TOTP yet
      if (mfaEnabled && !mfaVerified) {
        if (pathname === "/auth/mfa-verify") return true
        return Response.redirect(new URL("/auth/mfa-verify", nextUrl))
      }

      // Staff without MFA must enroll before accessing the app
      if (STAFF_ROLES.includes(role) && !mfaEnabled) {
        if (pathname === "/auth/mfa-setup") return true
        return Response.redirect(new URL("/auth/mfa-setup", nextUrl))
      }

      // Portal is off-limits to staff
      if (pathname.startsWith("/portal")) {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }

      // Fully authenticated users are redirected away from auth-flow pages
      if (pathname.startsWith("/auth/")) {
        return Response.redirect(new URL("/dashboard", nextUrl))
      }

      return true
    },
  },
}
