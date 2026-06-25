"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { hash } from "bcryptjs"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "settings:write")) return null
  return session
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "org"
}

export async function updateOrganization(opts: {
  name: string
}): Promise<{ ok: true } | { error: string }> {
  const session = await requireAdmin()
  if (!session) return { error: "Unauthorized" }

  await db.organization.update({
    where: { slug: session.user.orgId },
    data: { name: opts.name.trim() },
  })

  revalidatePath("/settings/organization")
  return { ok: true }
}

export async function createOrganization(opts: {
  name: string
  adminName: string
  adminEmail: string
  adminPassword: string
}): Promise<{ slug: string } | { error: string }> {
  const session = await requireAdmin()
  if (!session) return { error: "Unauthorized" }

  if (!opts.name.trim() || !opts.adminEmail.trim() || !opts.adminName.trim()) {
    return { error: "All fields are required." }
  }
  if (opts.adminPassword.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  const slug = slugify(opts.name)

  const existing = await db.organization.findUnique({ where: { slug } })
  if (existing) return { error: `Organization slug "${slug}" already exists.` }

  const emailInUse = await db.user.findUnique({ where: { email: opts.adminEmail.toLowerCase() } })
  if (emailInUse) return { error: "Admin email already in use." }

  await db.organization.create({ data: { slug, name: opts.name.trim() } })

  const passwordHash = await hash(opts.adminPassword, 12)
  await db.user.create({
    data: {
      name: opts.adminName.trim(),
      email: opts.adminEmail.trim().toLowerCase(),
      passwordHash,
      role: "ADMIN",
      orgId: slug,
    },
  })

  revalidatePath("/settings/organization")
  return { slug }
}
