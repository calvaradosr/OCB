// Run: npm run db:seed
import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"
import fs from "fs"
import path from "path"

const db = new PrismaClient()

const TEMPLATES_DIR = path.join(__dirname, "../src/lib/letters/templates")

const LETTER_TEMPLATES = [
  { file: "initial-dispute-bureau", name: "Initial Dispute Letter (Bureau)", target: "BUREAU", category: "INITIAL_DISPUTE" },
  { file: "reinvestigation", name: "Reinvestigation Demand", target: "BUREAU", category: "REINVESTIGATION" },
  { file: "method-of-verification", name: "Method of Verification Request", target: "BUREAU", category: "MOV" },
  { file: "goodwill-letter", name: "Goodwill Adjustment Letter", target: "BUREAU", category: "GOODWILL" },
  { file: "pay-for-delete", name: "Pay-for-Delete Offer", target: "COLLECTOR", category: "GOODWILL" },
  { file: "debt-validation-collector", name: "Debt Validation (Collector)", target: "COLLECTOR", category: "DEBT_VALIDATION" },
  { file: "identity-theft-block", name: "Identity Theft Block Notice", target: "BUREAU", category: "ID_THEFT" },
  { file: "inquiry-removal", name: "Unauthorized Inquiry Removal", target: "BUREAU", category: "INQUIRY" },
  { file: "hipaa-medical-collection", name: "HIPAA Medical Collection Dispute", target: "COLLECTOR", category: "HIPAA" },
  { file: "cfpb-complaint", name: "CFPB Complaint", target: "CFPB", category: "COMPLAINT" },
  { file: "ftc-identity-theft", name: "FTC Identity Theft Report", target: "FTC", category: "COMPLAINT" },
  { file: "state-ag-complaint", name: "State AG Complaint Letter", target: "STATE_AG", category: "COMPLAINT" },
]

async function main() {
  // ── Staff accounts ─────────────────────────────────────────────────────────
  const adminHash = await bcrypt.hash("Admin@OCB2026!", 12)
  const admin = await db.user.upsert({
    where: { email: "admin@oneconsultingbusiness.com" },
    update: {},
    create: {
      email: "admin@oneconsultingbusiness.com",
      passwordHash: adminHash,
      name: "OCB Admin",
      role: "ADMIN",
      mfaEnabled: false,
      active: true,
    },
  })

  const agentHash = await bcrypt.hash("Agent@OCB2026!", 12)
  const agent = await db.user.upsert({
    where: { email: "agent@oneconsultingbusiness.com" },
    update: {},
    create: {
      email: "agent@oneconsultingbusiness.com",
      passwordHash: agentHash,
      name: "Demo Agent",
      role: "AGENT",
      mfaEnabled: false,
      active: true,
    },
  })

  // ── Letter templates ────────────────────────────────────────────────────────
  for (const t of LETTER_TEMPLATES) {
    const bodyPath = path.join(TEMPLATES_DIR, `${t.file}.md`)
    if (!fs.existsSync(bodyPath)) {
      console.warn(`  Template file missing: ${bodyPath} — skipping`)
      continue
    }
    const body = fs.readFileSync(bodyPath, "utf8")
    const existing = await db.letterTemplate.findFirst({
      where: { name: t.name },
    })
    if (!existing) {
      await db.letterTemplate.create({
        data: {
          name: t.name,
          target: t.target as never,
          category: t.category,
          body,
          active: true,
        },
      })
    }
  }
  console.log(`  Letter templates seeded (${LETTER_TEMPLATES.length})`)

  // ── Demo clients ────────────────────────────────────────────────────────────
  const clients = [
    {
      firstName: "Maria",
      lastName: "Garcia",
      email: "maria.garcia@example.com",
      phone: "555-234-5678",
      status: "ACTIVE",
      modules: ["CREDIT_REPAIR"],
      assignedAgentId: agent.id,
      addressLine1: "742 Evergreen Terrace",
      city: "Springfield",
      state: "IL",
      zip: "62701",
    },
    {
      firstName: "James",
      lastName: "Williams",
      email: "j.williams@example.com",
      phone: "555-345-6789",
      status: "LEAD",
      modules: ["CREDIT_REPAIR", "LOAN"],
      assignedAgentId: null,
    },
    {
      firstName: "Sarah",
      lastName: "Johnson",
      email: "sarah.j@example.com",
      phone: "555-456-7890",
      status: "SIGNED",
      modules: ["CREDIT_REPAIR"],
      assignedAgentId: agent.id,
    },
    {
      firstName: "Robert",
      lastName: "Brown",
      email: "rbrown@example.com",
      status: "CONSULT_SCHEDULED",
      modules: ["CREDIT_REPAIR", "TRADELINE"],
      assignedAgentId: null,
    },
    {
      firstName: "Emily",
      lastName: "Davis",
      email: "emily.davis@example.com",
      status: "PAUSED",
      modules: ["CREDIT_REPAIR"],
      assignedAgentId: agent.id,
    },
  ]

  for (const c of clients) {
    const existing = await db.client.findFirst({
      where: { email: c.email, orgId: "ocb" },
    })
    if (!existing) {
      const client = await db.client.create({ data: { ...c, orgId: "ocb" } })

      if (c.firstName === "Maria") {
        // Seed a note
        await db.note.create({
          data: {
            clientId: client.id,
            authorId: agent.id,
            body: "Round 1 dispute letters sent to all 3 bureaus. Following up in 30 days.",
          },
        })

        // Seed a demo credit report with items
        const report = await db.creditReport.create({
          data: {
            clientId: client.id,
            source: "MANUAL_ENTRY",
            scoreExperian: 558,
            scoreEquifax: 572,
            scoreTransunion: 549,
            items: {
              create: [
                {
                  clientId: client.id,
                  type: "COLLECTION",
                  creditorName: "Portfolio Recovery Associates",
                  accountNumberMasked: "****1234",
                  onExperian: true,
                  onEquifax: true,
                  onTransunion: false,
                  balance: 2100.00,
                  flagged: true,
                },
                {
                  clientId: client.id,
                  type: "CHARGE_OFF",
                  creditorName: "Capital One Bank",
                  accountNumberMasked: "****5678",
                  onExperian: false,
                  onEquifax: true,
                  onTransunion: true,
                  balance: 4300.00,
                  flagged: true,
                },
                {
                  clientId: client.id,
                  type: "LATE_PAYMENT",
                  creditorName: "Wells Fargo Auto",
                  accountNumberMasked: "****9012",
                  onExperian: true,
                  onEquifax: true,
                  onTransunion: true,
                  balance: 0,
                  flagged: true,
                },
                {
                  clientId: client.id,
                  type: "INQUIRY",
                  creditorName: "First Premier Bank",
                  accountNumberMasked: null,
                  onExperian: true,
                  onEquifax: false,
                  onTransunion: false,
                  flagged: true,
                },
              ],
            },
          },
        })

        console.log(`  Demo credit report created for Maria Garcia (${report.id})`)
      }
    }
  }

  console.log("\nSeed complete.")
  console.log("  Admin : admin@oneconsultingbusiness.com / Admin@OCB2026!")
  console.log("  Agent : agent@oneconsultingbusiness.com / Agent@OCB2026!")
  console.log("  5 demo clients created (Maria has a seeded credit report)\n")
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
