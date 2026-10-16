import type { TFunction } from 'i18next';
import { AREAS } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
import type { OrgRole } from '@/types/org-team.types';

/** The five roles in the order a person reads them: who can do most first. */
export const ORG_ROLES: readonly OrgRole[] = ['Owner', 'Admin', 'PropertyManager', 'Collaborator', 'Accountant'];

// The keys are written out (`*Key:` properties) so that the i18n test finds a missing translation.
const ROLE_DESCRIPTIONS: Record<OrgRole, { descriptionKey: string }> = {
  Owner: { descriptionKey: 'team.roleDescriptions.Owner' },
  Admin: { descriptionKey: 'team.roleDescriptions.Admin' },
  PropertyManager: { descriptionKey: 'team.roleDescriptions.PropertyManager' },
  Collaborator: { descriptionKey: 'team.roleDescriptions.Collaborator' },
  Accountant: { descriptionKey: 'team.roleDescriptions.Accountant' },
};

/** What the role is for, in a sentence (never the names of its permissions). */
export function orgRoleDescription(role: OrgRole, t: TFunction): string {
  return t(ROLE_DESCRIPTIONS[role].descriptionKey);
}

/** The twelve capabilities of the matrix (backend `OrgCapabilityCatalog`), by their stable id. */
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

/** The name of a capability, or `undefined` for one this version of the app does not know (it is left out, never shown as a code). */
export function capabilityLabel(id: string, t: TFunction): string | undefined {
  return Object.hasOwn(CAPABILITY_LABELS, id) ? t(CAPABILITY_LABELS[id].labelKey) : undefined;
}

/** The name of an area as the area switcher writes it (`short-rent`, `long-rent`, `account`); an unknown one is shown as it is. */
export function areaName(area: string, t: TFunction): string {
  return Object.hasOwn(AREAS, area) ? t(AREAS[area as AppContextKey].nameKey) : area;
}
