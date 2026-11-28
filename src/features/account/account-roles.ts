import type { TFunction } from 'i18next';
import type { OrgRole } from '@/types/org-team.types';

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation.
const ORG_ROLE_LABELS: Record<OrgRole, { labelKey: string }> = {
  Owner: { labelKey: 'account.roles.Owner' },
  Admin: { labelKey: 'account.roles.Admin' },
  PropertyManager: { labelKey: 'account.roles.PropertyManager' },
  Collaborator: { labelKey: 'account.roles.Collaborator' },
  Accountant: { labelKey: 'account.roles.Accountant' },
};

const ORG_ROLE_OF_ACCOUNT_ROLE_KEY: Record<string, OrgRole> = {
  org_owner: 'Owner',
  org_admin: 'Admin',
  org_manager: 'PropertyManager',
  org_accountant: 'Accountant',
};

export function orgRoleLabel(role: string | undefined, t: TFunction): string {
  if (role === undefined) return '';
  return Object.hasOwn(ORG_ROLE_LABELS, role) ? t(ORG_ROLE_LABELS[role as OrgRole].labelKey) : role;
}

export function accountRoleLabel(roleKey: string | undefined, t: TFunction): string | undefined {
  const role = roleKey !== undefined && Object.hasOwn(ORG_ROLE_OF_ACCOUNT_ROLE_KEY, roleKey) ? ORG_ROLE_OF_ACCOUNT_ROLE_KEY[roleKey] : undefined;
  return role ? orgRoleLabel(role, t) : undefined;
}
