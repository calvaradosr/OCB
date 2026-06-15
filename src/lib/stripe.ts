import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set")
    _stripe = new Stripe(key, { apiVersion: "2026-05-27.dahlia" })
  }
  return _stripe
}

// Ensure the client has a Stripe Customer; create one if missing.
export async function ensureStripeCustomer(opts: {
  clientId: string
  orgId: string
  name: string
  email?: string | null
  existingCustomerId?: string | null
}): Promise<string> {
  const stripe = getStripe()
  if (opts.existingCustomerId) return opts.existingCustomerId

  const customer = await stripe.customers.create({
    name: opts.name,
    email: opts.email ?? undefined,
    metadata: { clientId: opts.clientId, orgId: opts.orgId },
  })

  return customer.id
}

// CROA guardrail: charge only after workPerformedAt is set.
// Throws if workPerformedAt is null.
export function assertWorkPerformed(workPerformedAt: Date | null): void {
  if (!workPerformedAt) {
    throw new Error(
      "CROA violation: cannot charge this invoice — workPerformedAt is not set. " +
      "Set workPerformedAt first to confirm the service has been performed."
    )
  }
}
