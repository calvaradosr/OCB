"use server"

import { db } from "@/lib/db"
import { hash } from "bcryptjs"
import { redirect } from "next/navigation"

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 32) || "org"
}

export async function createFirstAdmin(formData: FormData): Promise<{ error: string } | never> {
  const existingAdmin = await db.user.count({ where: { role: "ADMIN" } })
  if (existingAdmin > 0) {
    redirect("/login")
  }

  const name = (formData.get("name") as string | null)?.trim() ?? ""
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? ""
  const password = (formData.get("password") as string | null) ?? ""
  const orgName = (formData.get("orgName") as string | null)?.trim() ?? "My Organization"

  if (!name || !email) return { error: "Name and email are required." }
  if (password.length < 8) return { error: "Password must be at least 8 characters." }

  const slug = slugify(orgName)

  await db.organization.upsert({
    where: { slug },
    update: { name: orgName },
    create: { slug, name: orgName, plan: "standard" },
  })

  const passwordHash = await hash(password, 12)
  await db.user.create({
    data: { name, email, passwordHash, role: "ADMIN", orgId: slug },
  })

  redirect("/login?setup=done")
}
