// Auto letter generation — brief §4.3.
// Given the items selected in the dispute wizard, produce one letter per
// bureau containing ONLY the accounts disputed at that bureau, plus optional
// CFPB / FTC / State AG escalation letters built from the same selection.
import { render, MergeData } from "./render";

export type Bureau = "EXPERIAN" | "EQUIFAX" | "TRANSUNION";

export const BUREAU_ADDRESSES: Record<Bureau, { name: string; address: string }> = {
  EXPERIAN:   { name: "Experian",  address: "P.O. Box 4500, Allen, TX 75013" },
  EQUIFAX:    { name: "Equifax Information Services LLC", address: "P.O. Box 740256, Atlanta, GA 30374" },
  TRANSUNION: { name: "TransUnion Consumer Solutions", address: "P.O. Box 2000, Chester, PA 19016" },
};

export interface SelectedItem {
  creditorName: string;
  accountNumberMasked: string | null;
  type: string;
  reason: string; // dispute reason chosen in wizard
  bureaus: Bureau[]; // which bureaus this item is disputed at
}

export interface GeneratedLetter {
  target: "BUREAU" | "CFPB" | "FTC" | "STATE_AG";
  bureau?: Bureau;
  body: string;
}

export function generateBureauLetters(
  template: string,
  client: MergeData,
  items: SelectedItem[],
  opts?: { includeCFPB?: boolean; includeFTC?: boolean; includeStateAG?: boolean;
           cfpbTemplate?: string; ftcTemplate?: string; stateAgTemplate?: string }
): GeneratedLetter[] {
  const letters: GeneratedLetter[] = [];

  // Group items per bureau — each bureau letter lists only its own accounts.
  for (const bureau of Object.keys(BUREAU_ADDRESSES) as Bureau[]) {
    const bureauItems = items.filter(i => i.bureaus.includes(bureau));
    if (bureauItems.length === 0) continue;
    letters.push({
      target: "BUREAU",
      bureau,
      body: render(template, {
        client,
        bureau: BUREAU_ADDRESSES[bureau],
        items: bureauItems,
        date: new Date().toLocaleDateString("en-US"),
      }),
    });
  }

  // Escalations include ALL selected items across bureaus.
  const escalationData = {
    client,
    items,
    date: new Date().toLocaleDateString("en-US"),
  };
  if (opts?.includeCFPB && opts.cfpbTemplate)
    letters.push({ target: "CFPB", body: render(opts.cfpbTemplate, escalationData) });
  if (opts?.includeFTC && opts.ftcTemplate)
    letters.push({ target: "FTC", body: render(opts.ftcTemplate, escalationData) });
  if (opts?.includeStateAG && opts.stateAgTemplate)
    letters.push({ target: "STATE_AG", body: render(opts.stateAgTemplate, escalationData) });

  return letters;
}
