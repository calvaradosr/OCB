"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { hash } from "bcryptjs"
import { revalidatePath } from "next/cache"
import type { Role } from "@/lib/rbac"

async function requireUserManage() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "users:manage")) return null
  return session
}

export async function createStaffUser(opts: {
  name: string
  email: string
  password: string
  role: Role
}): Promise<{ id: string } | { error: string }> {
  const session = await requireUserManage()
  if (!session) return { error: "Unauthorized" }

  if (!opts.name.trim() || !opts.email.trim()) return { error: "Name and email are required" }

  const staffRoles: Role[] = ["ADMIN", "MANAGER", "AGENT", "LOAN_PROCESSOR"]
  if (!staffRoles.includes(opts.role)) return { error: "Invalid role" }

  const existing = await db.user.findUnique({ where: { email: opts.email.toLowerCase() } })
  if (existing) return { error: "Email already in use" }

  const passwordHash = await hash(opts.password, 12)

  const user = await db.user.create({
    data: {
      name: opts.name.trim(),
      email: opts.email.trim().toLowerCase(),
      passwordHash,
      role: opts.role,
      orgId: session.user.orgId,
    },
  })

  revalidatePath("/settings/users")
  return { id: user.id }
}

export async function updateStaffUser(
  userId: string,
  opts: { role?: Role; active?: boolean }
): Promise<{ ok: true } | { error: string }> {
  const session = await requireUserManage()
  if (!session) return { error: "Unauthorized" }

  if (userId === session.user.id && opts.active === false) {
    return { error: "You cannot deactivate your own account" }
  }

  await db.user.update({ where: { id: userId, orgId: session.user.orgId }, data: opts })
  revalidatePath("/settings/users")
  return { ok: true }
}

export async function resetUserMfa(
  userId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireUserManage()
  if (!session) return { error: "Unauthorized" }

  await db.user.update({
    where: { id: userId, orgId: session.user.orgId },
    data: { mfaEnabled: false, mfaSecret: null },
  })

  revalidatePath("/settings/users")
  return { ok: true }
}

export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ ok: true } | { error: string }> {
  const session = await requireUserManage()
  if (!session) return { error: "Unauthorized" }

  if (newPassword.length < 8) return { error: "Password must be at least 8 characters" }

  const passwordHash = await hash(newPassword, 12)
  await db.user.update({
    where: { id: userId, orgId: session.user.orgId },
    data: { passwordHash },
  })
  return { ok: true }
}
