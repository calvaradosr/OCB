import { describe, expect, it } from "vitest";
import { generateBureauLetters, SelectedItem } from "../generate";

const TPL = "{{bureau.name}}\n{{#each items}}- {{creditorName}} ({{reason}})\n{{/each}}";
const CLIENT = { firstName: "Test", lastName: "Client" };

const ITEMS: SelectedItem[] = [
  { creditorName: "ABC Collections", accountNumberMasked: "****1234", type: "COLLECTION", reason: "Not mine", bureaus: ["EXPERIAN", "TRANSUNION"] },
  { creditorName: "XYZ Bank", accountNumberMasked: "****9876", type: "LATE_PAYMENT", reason: "Never late", bureaus: ["EQUIFAX"] },
];

describe("generateBureauLetters", () => {
  it("creates one letter per bureau with only that bureau's accounts", () => {
    const letters = generateBureauLetters(TPL, CLIENT, ITEMS);
    expect(letters).toHaveLength(3);
    const experian = letters.find(l => l.bureau === "EXPERIAN")!;
    expect(experian.body).toContain("ABC Collections");
    expect(experian.body).not.toContain("XYZ Bank");
    const equifax = letters.find(l => l.bureau === "EQUIFAX")!;
    expect(equifax.body).toContain("XYZ Bank");
    expect(equifax.body).not.toContain("ABC Collections");
  });

  it("skips bureaus with no disputed items", () => {
    const letters = generateBureauLetters(TPL, CLIENT, [ITEMS[1]]);
    expect(letters).toHaveLength(1);
    expect(letters[0].bureau).toBe("EQUIFAX");
  });

  it("includes CFPB/FTC escalations with all items", () => {
    const letters = generateBureauLetters(TPL, CLIENT, ITEMS, {
      includeCFPB: true, cfpbTemplate: "CFPB:{{#each items}} {{creditorName}}{{/each}}",
      includeFTC: true, ftcTemplate: "FTC:{{#each items}} {{creditorName}}{{/each}}",
    });
    const cfpb = letters.find(l => l.target === "CFPB")!;
    expect(cfpb.body).toContain("ABC Collections");
    expect(cfpb.body).toContain("XYZ Bank");
    expect(letters.find(l => l.target === "FTC")).toBeDefined();
  });
});
