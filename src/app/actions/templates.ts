"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { revalidatePath } from "next/cache"
import fs from "fs/promises"
import path from "path"

const TEMPLATES_DIR = path.join(process.cwd(), "src/lib/letters/templates")

export async function getTemplateBody(templateId: string): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) throw new Error("Unauthorized")
  if (!can(session.user.role, "settings:write")) throw new Error("Forbidden")

  const { orgId } = session.user

  const override = await db.letterTemplate.findFirst({
    where: { name: `${orgId}:${templateId}`, active: true },
    select: { body: true },
  })
  if (override) return override.body

  return fs.readFile(path.join(TEMPLATES_DIR, `${templateId}.md`), "utf8")
}

export async function saveTemplate(
  templateId: string,
  body: string
): Promise<{ ok: boolean } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "settings:write")) return { error: "Forbidden" }
  if (!body.trim()) return { error: "Template body cannot be empty" }

  const { orgId } = session.user
  const key = `${orgId}:${templateId}`

  const existing = await db.letterTemplate.findFirst({
    where: { name: key, active: true },
    select: { id: true },
  })

  if (existing) {
    await db.letterTemplate.update({
      where: { id: existing.id },
      data: { body: body.trim() },
    })
  } else {
    await db.letterTemplate.create({
      data: {
        name: key,
        target: "BUREAU",
        category: templateId,
        body: body.trim(),
        active: true,
      },
    })
  }

  revalidatePath("/settings/templates")
  return { ok: true }
}

export async function resetTemplate(
  templateId: string
): Promise<{ ok: boolean } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "settings:write")) return { error: "Forbidden" }

  const { orgId } = session.user
  const key = `${orgId}:${templateId}`

  await db.letterTemplate.updateMany({
    where: { name: key },
    data: { active: false },
  })

  revalidatePath("/settings/templates")
  return { ok: true }
}
