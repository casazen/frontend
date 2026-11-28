import type { TFunction } from 'i18next';
import { AREAS } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
import type { OrgRole } from '@/types/org-team.types';

export const ORG_ROLES: readonly OrgRole[] = ['Owner', 'Admin', 'PropertyManager', 'Collaborator', 'Accountant'];

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation.
const ROLE_DESCRIPTIONS: Record<OrgRole, { descriptionKey: string }> = {
  Owner: { descriptionKey: 'team.roleDescriptions.Owner' },
  Admin: { descriptionKey: 'team.roleDescriptions.Admin' },
  PropertyManager: { descriptionKey: 'team.roleDescriptions.PropertyManager' },
  Collaborator: { descriptionKey: 'team.roleDescriptions.Collaborator' },
  Accountant: { descriptionKey: 'team.roleDescriptions.Accountant' },
};

export function orgRoleDescription(role: OrgRole, t: TFunction): string {
  return t(ROLE_DESCRIPTIONS[role].descriptionKey);
}

const CAPABILITY_LABELS: Record<string, { labelKey: string }> = {
  booking: { labelKey: 'team.capabilities.booking' },
  prices: { labelKey: 'team.capabilities.prices' },
  guests: { labelKey: 'team.capabilities.guests' },
  money: { labelKey: 'team.capabilities.money' },
  leases: { labelKey: 'team.capabilities.leases' },
  rents: { labelKey: 'team.capabilities.rents' },
  jobs: { labelKey: 'team.capabilities.jobs' },
  people: { labelKey: 'team.capabilities.people' },
  billing: { labelKey: 'team.capabilities.billing' },
  suppliers: { labelKey: 'team.capabilities.suppliers' },
  settings: { labelKey: 'team.capabilities.settings' },
  security: { labelKey: 'team.capabilities.security' },
};

export function capabilityLabel(id: string, t: TFunction): string | undefined {
  return Object.hasOwn(CAPABILITY_LABELS, id) ? t(CAPABILITY_LABELS[id].labelKey) : undefined;
}

export function areaName(area: string, t: TFunction): string {
  return Object.hasOwn(AREAS, area) ? t(AREAS[area as AppContextKey].nameKey) : area;
}
