// Edge-compatible NextAuth config — NO Prisma imports.
// Used by middleware.ts for JWT validation on the Edge.
import type { NextAuthConfig } from "next-auth"
import type { Role } from "@/lib/rbac"

const CLIENT_HOME = "/portal/dashboard"

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.orgId = user.orgId
      }
      return token
    },

    session({ session, token }) {
      session.user.id = (token.id as string) ?? ""
      session.user.role = (token.role as Role) ?? "CLIENT"
      session.user.orgId = (token.orgId as string) ?? "ocb"
      return session
    },

    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth
      const pathname = nextUrl.pathname

      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl))
      }

      const { role } = auth.user

      // CLIENT role: lives in /portal only
      if (role === "CLIENT") {
        if (pathname.startsWith("/portal") || pathname === "/login") return true
        return Response.redirect(new URL(CLIENT_HOME, nextUrl))
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
