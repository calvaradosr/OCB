import { db } from "@/lib/db"
import { notFound } from "next/navigation"
import SignupForm from "./SignupForm"

export default async function AffiliateSignupPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  const affiliate = await db.affiliate.findUnique({
    where: { code, active: true },
    include: {
      user: { select: { name: true } },
    },
  })

  if (!affiliate) notFound()

  const org = await db.organization.findUnique({
    where: { slug: affiliate.orgId },
    select: { name: true },
  })

  return (
    <SignupForm
      affiliateCode={code}
      affiliateName={affiliate.user.name}
      orgName={org?.name ?? "Credit Repair Services"}
    />
  )
}
