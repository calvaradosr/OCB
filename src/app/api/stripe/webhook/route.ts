import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature or secret" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret)
  } catch (e) {
    return NextResponse.json({ error: `Webhook error: ${(e as Error).message}` }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice
        const invoiceId = inv.metadata?.invoiceId
        if (invoiceId) {
          await db.invoice.updateMany({
            where: { stripeInvoiceId: inv.id },
            data: { status: "PAID" },
          })
        }
        await writeAuditLog({
          action: "UPDATE",
          entity: "StripeInvoice",
          entityId: inv.id,
          detail: { event: "invoice.paid", amount: inv.amount_paid },
        })
        break
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice
        await db.invoice.updateMany({
          where: { stripeInvoiceId: inv.id },
          data: { status: "FAILED" },
        })
        await writeAuditLog({
          action: "UPDATE",
          entity: "StripeInvoice",
          entityId: inv.id,
          detail: { event: "invoice.payment_failed" },
        })
        break
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription
        const status = sub.status
        const cancelAtPeriodEnd = sub.cancel_at_period_end
        const periodEnd = (sub as unknown as { current_period_end: number }).current_period_end

        await db.subscription.updateMany({
          where: { stripeSubscriptionId: sub.id },
          data: {
            status,
            cancelAtPeriodEnd,
            currentPeriodEnd: new Date(periodEnd * 1000),
          },
        })
        await writeAuditLog({
          action: "UPDATE",
          entity: "Subscription",
          entityId: sub.id,
          detail: { event: event.type, status },
        })
        break
      }
    }
  } catch (e) {
    console.error("Webhook handler error:", e)
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
