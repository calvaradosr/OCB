// Merge-field renderer. Templates use {{path.to.value}} syntax.
// Supports {{#each items}}...{{/each}} blocks for account lists.
export type MergeData = Record<string, unknown>;

function get(data: MergeData, path: string): string {
  const v = path.split(".").reduce<unknown>(
    (acc, k) => (acc && typeof acc === "object" ? (acc as MergeData)[k] : undefined),
    data
  );
  return v == null ? "" : String(v);
}

export function render(template: string, data: MergeData): string {
  // {{#each items}} block {{/each}}
  let out = template.replace(
    /\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
    (_, listName: string, block: string) => {
      const list = data[listName];
      if (!Array.isArray(list)) return "";
      return list
        .map(item => block.replace(/\{\{(\w[\w.]*)\}\}/g, (_m, p: string) => get(item as MergeData, p)))
        .join("");
    }
  );
  // simple fields
  out = out.replace(/\{\{(\w[\w.]*)\}\}/g, (_m, p: string) => get(data, p));
  return out.trim();
}
