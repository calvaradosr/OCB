"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { AutomationTrigger, AutomationAction } from "@prisma/client"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) return null
  if (!can(session.user.role, "settings:write")) return null
  return session
}

export async function createAutomation(opts: {
  name: string
  trigger: AutomationTrigger
  conditions?: Record<string, string>
  action: AutomationAction
  actionConfig: Record<string, unknown>
}): Promise<{ id: string } | { error: string }> {
  const session = await requireAdmin()
  if (!session) return { error: "Unauthorized" }

  if (!opts.name.trim()) return { error: "Name is required" }

  const automation = await db.automation.create({
    data: {
      name: opts.name.trim(),
      trigger: opts.trigger,
      conditions: opts.conditions && Object.keys(opts.conditions).length ? opts.conditions : undefined,
      action: opts.action,
      actionConfig: opts.actionConfig,
    },
  })

  revalidatePath("/automations")
  return { id: automation.id }
}

export async function updateAutomation(
  id: string,
  opts: {
    name?: string
    trigger?: AutomationTrigger
    conditions?: Record<string, string> | null
    action?: AutomationAction
    actionConfig?: Record<string, unknown>
    active?: boolean
  }
): Promise<{ ok: true } | { error: string }> {
  const session = await requireAdmin()
  if (!session) return { error: "Unauthorized" }

  await db.automation.update({ where: { id }, data: opts })
  revalidatePath("/automations")
  return { ok: true }
}

export async function deleteAutomation(id: string): Promise<{ ok: true } | { error: string }> {
  const session = await requireAdmin()
  if (!session) return { error: "Unauthorized" }

  await db.automation.delete({ where: { id } })
  revalidatePath("/automations")
  return { ok: true }
}
