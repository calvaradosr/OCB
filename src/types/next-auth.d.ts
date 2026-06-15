import type { Role } from "../lib/rbac"
import "next-auth"
import "next-auth/jwt"

declare module "next-auth" {
  interface User {
    role: Role
    mfaEnabled: boolean
    mfaVerified: boolean
  }

  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: Role
      mfaEnabled: boolean
      mfaVerified: boolean
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: Role
    mfaEnabled?: boolean
    mfaVerified?: boolean
  }
}
