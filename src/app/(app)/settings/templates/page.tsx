import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { can } from "@/lib/rbac"
import { db } from "@/lib/db"
import { TEMPLATE_LABELS } from "@/lib/report-utils"
import { TemplateEditor } from "./TemplateEditor"

const TARGET_LABELS: Record<string, string> = {
  "initial-dispute-bureau":    "Bureau",
  "reinvestigation":           "Bureau",
  "method-of-verification":    "Bureau",
  "goodwill-letter":           "Furnisher",
  "pay-for-delete":            "Furnisher",
  "debt-validation-collector": "Collector",
  "identity-theft-block":      "Bureau",
  "inquiry-removal":           "Bureau",
  "hipaa-medical-collection":  "Furnisher",
  "cfpb-complaint":            "CFPB",
  "ftc-identity-theft":        "FTC",
  "state-ag-complaint":        "State AG",
}

const TARGET_COLORS: Record<string, string> = {
  Bureau: "bg-primary/10 text-primary",
  Furnisher: "bg-secondary/20 text-ink",
  Collector: "bg-secondary/20 text-ink",
  CFPB: "bg-success/10 text-success",
  FTC: "bg-success/10 text-success",
  "State AG": "bg-warning/10 text-warning",
}

export default async function TemplatesPage() {
  const session = await auth()
  if (!session) redirect("/login")
  if (!can(session.user.role, "settings:write")) redirect("/dashboard")

  const { orgId } = session.user

  // Check which templates have been customized for this org
  const customized = await db.letterTemplate.findMany({
    where: { name: { startsWith: `${orgId}:` }, active: true },
    select: { name: true },
  })
  const customizedSet = new Set(customized.map(t => t.name.replace(`${orgId}:`, "")))

  const templateIds = Object.keys(TEMPLATE_LABELS)

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Letter Templates</h1>
        <p className="text-sm text-muted mt-1">
          Customize the default dispute letters for your organization. Changes apply to all new disputes.
        </p>
      </div>

      <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 text-sm text-warning">
        CROA compliance: All letter text must avoid guaranteed-outcome language.
        Do not promise specific score increases or guaranteed deletions.
      </div>

      <div className="bg-white rounded-xl border border-secondary-soft overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary-soft/30">
            <tr className="text-xs text-muted uppercase tracking-wide">
              <th className="py-3 px-5 text-left">Template</th>
              <th className="py-3 px-5 text-left">Sent to</th>
              <th className="py-3 px-5 text-left">Status</th>
              <th className="py-3 px-5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-secondary-soft">
            {templateIds.map(id => {
              const isCustom = customizedSet.has(id)
              const target = TARGET_LABELS[id] ?? "Bureau"
              return (
                <tr key={id} className="hover:bg-secondary-soft/10">
                  <td className="py-3 px-5 font-medium text-ink">
                    {TEMPLATE_LABELS[id] ?? id}
                  </td>
                  <td className="py-3 px-5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TARGET_COLORS[target] ?? "bg-secondary-soft text-muted"}`}>
                      {target}
                    </span>
                  </td>
                  <td className="py-3 px-5">
                    {isCustom ? (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        Customized
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Default</span>
                    )}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <TemplateEditor
                      templateId={id}
                      label={TEMPLATE_LABELS[id] ?? id}
                      hasCustom={isCustom}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Merge fields like <code className="bg-secondary-soft px-1 rounded">{"{{client.firstName}}"}</code> are replaced
        automatically when letters are generated. Click Edit on any template to see all available fields.
      </p>
    </div>
  )
}
