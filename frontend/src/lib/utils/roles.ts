// Role model: strict hierarchy, lower number = more privileged.
// Checks use `role <= N`.

export const ROLE = {
  AUDIT_ADMIN: 1,
  ADMIN: 2,
  USER: 3,
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];

export const ROLE_LABELS: Record<Role, string> = {
  [ROLE.AUDIT_ADMIN]: 'Audit Admin',
  [ROLE.ADMIN]: 'Admin',
  [ROLE.USER]: 'User',
};

/** Audit Admin only — start/close audit cycles. */
export const canManageAudit = (role?: number | null): boolean =>
  role != null && role <= ROLE.AUDIT_ADMIN;

/** Admin and above — user management, change log, lookups. */
export const canAdmin = (role?: number | null): boolean =>
  role != null && role <= ROLE.ADMIN;

export const isValidRole = (role: unknown): role is Role =>
  role === ROLE.AUDIT_ADMIN || role === ROLE.ADMIN || role === ROLE.USER;

/**
 * Whether `actorRole` may assign `targetRole` to a user.
 * You cannot mint someone more privileged than yourself (target >= actor).
 */
export const canAssignRole = (actorRole: number | null | undefined, targetRole: number): boolean =>
  canAdmin(actorRole) && isValidRole(targetRole) && targetRole >= (actorRole as number);
