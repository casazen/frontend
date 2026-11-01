import type { ComplianceSummaryResult, ComplianceSummarySection } from '@/types/compliance.types';

/**
 * How much a thing of the cockpit weighs for the host, in three levels:
 * - `fine`: the law gives it a deadline and the host answers for it (the Alloggiati Web communication, the guest data it needs):
 *   if it is not done in time the host risks a sanction. It is always on the page, and its number is on the menu.
 * - `start`: it keeps the property from starting (the activation: CIN, documents, safety checklist). Nothing else is at risk: the
 *   property just does not work, because it is not active, so it cannot be booked from the site (`IPublicAvailabilityService`).
 * - `chore`: the upkeep of a stay that is over (close the departure, declare the property ready).
 */
export type CockpitTier = 'fine' | 'start' | 'chore';

/** The sections of `GET api/compliance/summary` that carry a deadline of the law, whatever the stay. */
export const FINE_FIELDS = ['alloggiatiFailures', 'alloggiatiManualRequired', 'guestCheckInsIncomplete'] as const satisfies readonly (keyof ComplianceSummaryResult)[];

export const TIER_OF_FIELD: Readonly<Record<keyof ComplianceSummaryResult, CockpitTier>> = {
  alloggiatiFailures: 'fine',
  alloggiatiManualRequired: 'fine',
  guestCheckInsIncomplete: 'fine',
  propertiesPending: 'start',
  checkoutsDue: 'chore',
  turnoversPending: 'chore',
};

const countOf = (section: ComplianceSummarySection | null | undefined): number => (typeof section?.count === 'number' ? section.count : 0);

/**
 * How many things carry a risk of a sanction right now (what the server counts, which is more than it lists). It is the number on
 * the menu entry «Adempimenti» and the reason of the block on the Home: a section a version of the API does not send is zero.
 */
export function fineCount(summary: Partial<ComplianceSummaryResult> | null | undefined): number {
  return FINE_FIELDS.reduce((sum, field) => sum + countOf(summary?.[field]), 0);
}
