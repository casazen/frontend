import type { UserSummary } from '@/types';

/** Maps backend user DTO fields (camelCase or legacy PascalCase) to frontend shape. */
export function normalizeUserSummary(raw: Record<string, unknown>): UserSummary {
  return {
    id: String(raw.id ?? raw.Id ?? ''),
    email: String(raw.email ?? raw.Email ?? ''),
    firstName: String(raw.firstName ?? raw.FirstName ?? ''),
    lastName: String(raw.lastName ?? raw.LastName ?? ''),
    role: (raw.role ?? raw.Role ?? 'Guest') as UserSummary['role'],
    rentalType: (raw.rentalType ?? raw.RentalType ?? null) as UserSummary['rentalType'],
    isActive: Boolean(raw.isActive ?? raw.IsActive ?? true),
    createdAt: String(raw.createdAt ?? raw.CreatedAt ?? ''),
    orgId: (raw.orgId ?? raw.OrgId ?? null) as string | null,
    orgName: (raw.orgName ?? raw.OrgName ?? null) as string | null,
    planTier: (raw.planTier ?? raw.PlanTier ?? null) as UserSummary['planTier'],
  };
}
