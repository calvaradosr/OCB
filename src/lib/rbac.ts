// Role-based access control — single source of truth for permissions.
// Brief §3: build RBAC before any module.
export type Role =
  | "ADMIN" | "MANAGER" | "AGENT" | "LOAN_PROCESSOR" | "AFFILIATE" | "CLIENT";

export type Permission =
  | "clients:read" | "clients:write" | "clients:read_pii"
  | "disputes:read" | "disputes:write"
  | "letters:generate" | "letters:send"
  | "reports:import"
  | "billing:read" | "billing:write"
  | "settings:write" | "users:manage"
  | "loans:read" | "loans:write"
  | "tradelines:read" | "tradelines:write"
  | "portal:client" | "portal:affiliate";

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: [
    "clients:read", "clients:write", "clients:read_pii",
    "disputes:read", "disputes:write", "letters:generate", "letters:send",
    "reports:import", "billing:read", "billing:write",
    "settings:write", "users:manage",
    "loans:read", "loans:write", "tradelines:read", "tradelines:write",
  ],
  MANAGER: [
    "clients:read", "clients:write", "clients:read_pii",
    "disputes:read", "disputes:write", "letters:generate", "letters:send",
    "reports:import", "billing:read",
    "loans:read", "loans:write", "tradelines:read", "tradelines:write",
  ],
  AGENT: [
    "clients:read", "clients:write",
    "disputes:read", "disputes:write", "letters:generate", "letters:send",
    "reports:import",
  ],
  LOAN_PROCESSOR: ["clients:read", "loans:read", "loans:write"],
  AFFILIATE: ["portal:affiliate"],
  CLIENT: ["portal:client"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}
