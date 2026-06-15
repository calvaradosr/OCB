"use server"

import { auth } from "@/auth"
import { db } from "@/lib/db"
import { can } from "@/lib/rbac"
import { writeAuditLog } from "@/lib/audit"
import { getStripe, ensureStripeCustomer, assertWorkPerformed } from "@/lib/stripe"
import { revalidatePath } from "next/cache"

// Create a Stripe subscription for a client (setup fee + recurring monthly).
export async function createSubscription(
  clientId: string,
  opts: {
    priceId: string         // Stripe Price ID for the recurring plan
    setupFeeCents?: number  // one-time setup fee (charged after work)
  }
): Promise<{ subscriptionId: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "billing:write")) return { error: "Unauthorized" }

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return { error: "Client not found" }

  try {
    const stripe = getStripe()

    const stripeCustomerId = await ensureStripeCustomer({
      clientId,
      orgId: client.orgId,
      name: `${client.firstName} ${client.lastName}`,
      email: client.email,
      existingCustomerId: client.stripeCustomerId,
    })

    // Persist customer id if newly created
    if (!client.stripeCustomerId) {
      await db.client.update({
        where: { id: clientId },
        data: { stripeCustomerId },
      })
    }

    const sub = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: opts.priceId }],
      // Arrears: bill at end of period
      billing_cycle_anchor_config: undefined,
      collection_method: "charge_automatically",
      metadata: { clientId, orgId: client.orgId },
    })

    await db.subscription.create({
      data: {
        clientId,
        stripeSubscriptionId: sub.id,
        stripeProductId: sub.items.data[0]?.price.product as string,
        stripePriceId: sub.items.data[0]?.price.id,
        status: sub.status,
        currentPeriodEnd: new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000),
      },
    })

    // Create draft setup-fee invoice if requested (charged after work)
    if (opts.setupFeeCents && opts.setupFeeCents > 0) {
      await db.invoice.create({
        data: {
          clientId,
          amountCents: opts.setupFeeCents,
          description: "Setup fee",
          status: "DRAFT",
        },
      })
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "CREATE",
      entity: "Subscription",
      entityId: sub.id,
      detail: { clientId, priceId: opts.priceId },
    })

    revalidatePath(`/clients/${clientId}/billing`)
    return { subscriptionId: sub.id }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// Cancel a subscription at period end.
export async function cancelSubscription(
  subscriptionId: string,
  clientId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "billing:write")) return { error: "Unauthorized" }

  try {
    const stripe = getStripe()
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true })

    await db.subscription.update({
      where: { stripeSubscriptionId: subscriptionId },
      data: { cancelAtPeriodEnd: true },
    })

    await writeAuditLog({
      actorId: session.user.id,
      action: "UPDATE",
      entity: "Subscription",
      entityId: subscriptionId,
      detail: { action: "cancel_at_period_end", clientId },
    })

    revalidatePath(`/clients/${clientId}/billing`)
    return { ok: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// Mark an invoice's work as performed, then charge via Stripe.
// CROA: workPerformedAt must be set before charging.
export async function chargeInvoice(
  invoiceId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "billing:write")) return { error: "Unauthorized" }

  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: true },
  })
  if (!invoice) return { error: "Invoice not found" }

  try {
    assertWorkPerformed(invoice.workPerformedAt)
  } catch (e) {
    return { error: (e as Error).message }
  }

  if (invoice.status !== "DRAFT" && invoice.status !== "OPEN") {
    return { error: `Invoice is already ${invoice.status}` }
  }

  try {
    const stripe = getStripe()

    const stripeCustomerId = invoice.client.stripeCustomerId
    if (!stripeCustomerId) return { error: "Client has no Stripe customer" }

    // Create a Stripe invoice item then finalize + charge
    await stripe.invoiceItems.create({
      customer: stripeCustomerId,
      amount: invoice.amountCents,
      currency: "usd",
      description: invoice.description,
      metadata: { invoiceId: invoice.id, clientId: invoice.clientId },
    })

    const stripeInvoice = await stripe.invoices.create({
      customer: stripeCustomerId,
      auto_advance: true,
      metadata: { invoiceId: invoice.id, clientId: invoice.clientId },
    })

    await stripe.invoices.finalizeInvoice(stripeInvoice.id)
    const paid = await stripe.invoices.pay(stripeInvoice.id)

    await db.invoice.update({
      where: { id: invoiceId },
      data: {
        stripeInvoiceId: paid.id,
        status: paid.status === "paid" ? "PAID" : "OPEN",
      },
    })

    await writeAuditLog({
      actorId: session.user.id,
      action: "UPDATE",
      entity: "Invoice",
      entityId: invoiceId,
      detail: { action: "charge", stripeInvoiceId: paid.id },
    })

    revalidatePath(`/clients/${invoice.clientId}/billing`)
    return { ok: true }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// Mark workPerformedAt on an invoice (prerequisite before charging).
export async function markWorkPerformed(
  invoiceId: string
): Promise<{ ok: true } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "billing:write")) return { error: "Unauthorized" }

  const invoice = await db.invoice.findUnique({ where: { id: invoiceId } })
  if (!invoice) return { error: "Invoice not found" }

  await db.invoice.update({
    where: { id: invoiceId },
    data: { workPerformedAt: new Date(), status: "OPEN" },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "UPDATE",
    entity: "Invoice",
    entityId: invoiceId,
    detail: { action: "mark_work_performed" },
  })

  revalidatePath(`/clients/${invoice.clientId}/billing`)
  return { ok: true }
}

// Create a Stripe Billing Portal session for a client to manage payment methods.
export async function createBillingPortalSession(
  clientId: string,
  returnUrl: string
): Promise<{ url: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }

  // Allow both staff and the CLIENT themselves
  const isClientPortal = session.user.role === "CLIENT"
  let targetClient: { stripeCustomerId: string | null } | null = null

  if (isClientPortal) {
    targetClient = await db.client.findFirst({
      where: { portalUserId: session.user.id },
      select: { stripeCustomerId: true },
    })
  } else {
    if (!can(session.user.role, "billing:read")) return { error: "Unauthorized" }
    targetClient = await db.client.findUnique({
      where: { id: clientId },
      select: { stripeCustomerId: true },
    })
  }

  if (!targetClient?.stripeCustomerId) return { error: "No billing account found" }

  try {
    const stripe = getStripe()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: targetClient.stripeCustomerId,
      return_url: returnUrl,
    })
    return { url: portalSession.url }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

// Create a draft invoice (staff only).
export async function createInvoice(
  clientId: string,
  opts: { amountCents: number; description: string }
): Promise<{ id: string } | { error: string }> {
  const session = await auth()
  if (!session?.user?.id) return { error: "Unauthorized" }
  if (!can(session.user.role, "billing:write")) return { error: "Unauthorized" }

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) return { error: "Client not found" }

  const inv = await db.invoice.create({
    data: {
      clientId,
      amountCents: opts.amountCents,
      description: opts.description,
      status: "DRAFT",
    },
  })

  await writeAuditLog({
    actorId: session.user.id,
    action: "CREATE",
    entity: "Invoice",
    entityId: inv.id,
    detail: { clientId, amountCents: opts.amountCents },
  })

  revalidatePath(`/clients/${clientId}/billing`)
  return { id: inv.id }
}
