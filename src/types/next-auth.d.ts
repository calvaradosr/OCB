import type { Role } from "../lib/rbac"
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role: Role
    orgId: string
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: Role
      orgId: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: Role
    orgId?: string
  }
}
