import { db } from "@/lib/db"
import { sendEmail, renderTemplate } from "@/lib/email"
import { sendSms } from "@/lib/sms"
import { AutomationTrigger, AutomationAction } from "@prisma/client"

export type TriggerContext = {
  trigger: AutomationTrigger
  clientId?: string
  triggeredBy?: string          // entityId (reportId, disputeId, invoiceId…)
  metadata?: Record<string, unknown>
}

// Run all active automations that match the given trigger.
// Non-blocking: errors in individual actions are logged, not thrown.
export async function runAutomations(ctx: TriggerContext): Promise<void> {
  const automations = await db.automation.findMany({
    where: { trigger: ctx.trigger, active: true },
  })

  if (automations.length === 0) return

  // Load client once if needed
  const client = ctx.clientId
    ? await db.client.findUnique({
        where: { id: ctx.clientId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          modules: true,
          assignedAgentId: true,
          assignedAgent: { select: { email: true, name: true } },
        },
      })
    : null

  for (const automation of automations) {
    try {
      // Evaluate optional conditions
      if (automation.conditions && client) {
        const cond = automation.conditions as Record<string, unknown>
        // Filter by module e.g. { "module": "CREDIT_REPAIR" }
        if (cond.module && !client.modules.includes(cond.module as string)) continue
        // Filter by status e.g. { "status": "ACTIVE" }
        if (cond.status) {
          const fullClient = await db.client.findUnique({
            where: { id: client.id },
            select: { status: true },
          })
          if (fullClient?.status !== cond.status) continue
        }
      }

      const cfg = automation.actionConfig as Record<string, unknown>
      const mergeVars = {
        firstName: client?.firstName ?? "",
        lastName: client?.lastName ?? "",
        email: client?.email ?? "",
        agentName: client?.assignedAgent?.name ?? "Your consultant",
      }

      let result = "SUCCESS"
      let detail: unknown = null

      switch (automation.action) {
        case AutomationAction.SEND_EMAIL: {
          if (!client?.email) { result = "FAILED"; detail = "no client email"; break }
          const subject = renderTemplate(String(cfg.subject ?? ""), mergeVars)
          const html = renderTemplate(String(cfg.html ?? cfg.body ?? ""), mergeVars)
          await sendEmail({ to: client.email, subject, html })
          break
        }

        case AutomationAction.SEND_SMS: {
          if (!client?.phone) { result = "FAILED"; detail = "no client phone"; break }
          const body = renderTemplate(String(cfg.body ?? ""), mergeVars)
          await sendSms(client.phone, body)
          break
        }

        case AutomationAction.CREATE_TASK: {
          const text = renderTemplate(String(cfg.task ?? cfg.body ?? "Follow up required"), mergeVars)
          await db.note.create({
            data: {
              clientId: ctx.clientId!,
              authorId: null,
              body: `[Auto-task] ${text}`,
            },
          })
          break
        }

        case AutomationAction.NOTIFY_CLIENT: {
          if (!ctx.clientId) break
          const body = renderTemplate(String(cfg.body ?? ""), mergeVars)
          await db.message.create({
            data: {
              clientId: ctx.clientId,
              senderRole: "SYSTEM",
              senderId: "system",
              body,
            },
          })
          break
        }

        case AutomationAction.CHARGE_PER_DELETE: {
          // Only fires if the trigger is DISPUTE_OUTCOME_DELETED.
          // Looks for a matching per-delete invoice template and creates one.
          // Actual Stripe charge is deferred until staff calls chargeInvoice().
          if (!ctx.clientId) break
          const amountCents = Number(cfg.amountCents ?? 0)
          if (!amountCents) { result = "FAILED"; detail = "amountCents not set"; break }
          await db.invoice.create({
            data: {
              clientId: ctx.clientId,
              amountCents,
              description: String(cfg.description ?? "Per-deletion fee"),
              status: "DRAFT",
            },
          })
          break
        }
      }

      await db.automationLog.create({
        data: {
          automationId: automation.id,
          clientId: ctx.clientId,
          triggeredBy: ctx.triggeredBy,
          result,
          detail: detail ? { message: detail } : undefined,
        },
      })
    } catch (err) {
      await db.automationLog.create({
        data: {
          automationId: automation.id,
          clientId: ctx.clientId,
          triggeredBy: ctx.triggeredBy,
          result: "FAILED",
          detail: { message: String(err) },
        },
      }).catch(() => {})
    }
  }
}
