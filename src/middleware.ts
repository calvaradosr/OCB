// Route protection middleware — uses Edge-compatible auth.config (no Prisma).
// Auth.js decodes the JWT cookie on every request; no database hit.
import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

const { auth: middleware } = NextAuth(authConfig)
export default middleware

export const config = {
  // Run on all routes except Next.js internals, static files, and auth endpoints
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api/auth).*)"],
}
