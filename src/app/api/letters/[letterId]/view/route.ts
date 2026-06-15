import { auth } from "@/auth"
import { db } from "@/lib/db"
import { writeAuditLog } from "@/lib/audit"
import { BUREAU_LABELS, LETTER_TARGET_LABELS } from "@/lib/report-utils"

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

function buildHTML(
  body: string,
  clientName: string,
  target: string,
  bureau: string | null
): string {
  const heading = bureau
    ? `${LETTER_TARGET_LABELS[target] ?? target} — ${BUREAU_LABELS[bureau as keyof typeof BUREAU_LABELS] ?? bureau}`
    : (LETTER_TARGET_LABELS[target] ?? target)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(heading)} — ${esc(clientName)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    color: #000;
    background: #fff;
    padding: 2rem;
    max-width: 800px;
    margin: 0 auto;
  }
  .toolbar {
    background: #f5f5f5;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 12px 16px;
    margin-bottom: 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .toolbar-title { font-family: sans-serif; font-size: 13px; color: #444; }
  .btn-print {
    background: #A8862B;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 8px 16px;
    font-family: sans-serif;
    font-size: 13px;
    cursor: pointer;
    font-weight: 600;
  }
  .btn-print:hover { background: #8A6E20; }
  .letter { padding: 1rem 0; }
  .letter pre {
    font-family: "Times New Roman", Times, serif;
    font-size: 12pt;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
  }
  @media print {
    .toolbar { display: none !important; }
    body { padding: 0; max-width: 100%; }
    .letter { padding: 0; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <div class="toolbar-title">
    <strong>${esc(heading)}</strong> &mdash; ${esc(clientName)}
  </div>
  <button class="btn-print" onclick="window.print()">Print / Save as PDF</button>
</div>
<div class="letter">
  <pre>${esc(body)}</pre>
</div>
</body>
</html>`
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ letterId: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const { letterId } = await params

  const letter = await db.letter.findUnique({
    where: { id: letterId },
    include: {
      client: { select: { id: true, firstName: true, lastName: true } },
    },
  })
  if (!letter) return new Response("Not found", { status: 404 })

  await writeAuditLog({
    actorId: session.user.id,
    action: "VIEW",
    entity: "Letter",
    entityId: letterId,
    detail: { target: letter.target, bureau: letter.bureau },
  })

  const html = buildHTML(
    letter.renderedBody,
    `${letter.client.firstName} ${letter.client.lastName}`,
    letter.target,
    letter.bureau
  )

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}
