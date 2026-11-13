import type { ComplianceSummaryResult, ComplianceSummarySection } from '@/types/compliance.types';
import { lightStateOf, sectionItems, type SectionField } from './compliance-light';

/**
 * How much a thing of the cockpit weighs for the host, in three levels:
 * - `fine`: the law gives it a deadline and the host answers for it (the Alloggiati Web communication, the guest data it needs, ISTAT and
 *   the tourist tax of a month, the police send that makes the first one possible): if it is not done in time the host risks a sanction.
 *   It is always on the page, and its number is on the menu.
 * - `start`: it keeps the property from starting (the activation: CIN, documents, safety checklist). Nothing else is at risk: the
 *   property just does not work, because it is not active, so it cannot be booked from the site (`IPublicAvailabilityService`).
 * - `chore`: the upkeep of a stay (close the departure, declare the property ready, verify the identity of the guest).
 */
export type CockpitTier = 'fine' | 'start' | 'chore';

/** The sections of `GET api/compliance/summary` that carry a deadline of the law, whatever the stay. */
export const FINE_FIELDS = ['alloggiatiFailures', 'alloggiatiManualRequired', 'guestCheckInsIncomplete'] as const satisfies readonly (keyof ComplianceSummaryResult)[];

/**
 * The sections the traffic light adds for the Alloggiati Web communication of a stay: the stays it takes out of `alloggiatiManualRequired`
 * (to send by hand, sent or entrusted with the receipt awaited). Only their red items carry a risk of a sanction now: a yellow one is in
 * hand and a green one is done.
 */
const LIT_FINE_FIELDS = ['manualSendsRequired', 'receiptsToUpload'] as const satisfies readonly SectionField[];

export const TIER_OF_FIELD: Readonly<Record<keyof ComplianceSummaryResult, CockpitTier>> = {
  alloggiatiFailures: 'fine',
  alloggiatiManualRequired: 'fine',
  guestCheckInsIncomplete: 'fine',
  manualSendsRequired: 'fine',
  receiptsToUpload: 'fine',
  connectionsToFix: 'fine',
  periodItems: 'fine',
  propertiesPending: 'start',
  checkoutsDue: 'chore',
  turnoversPending: 'chore',
  identityPending: 'chore',
};

const countOf = (section: ComplianceSummarySection | null | undefined): number => (typeof section?.count === 'number' ? section.count : 0);

/**
 * How many things carry a risk of a sanction right now (what the server counts, which is more than it lists). It is the number on
 * the menu entry «Adempimenti» and the reason of the block on the Home: a section a version of the API does not send is zero. With the
 * traffic light on, the stays it moves into `manualSendsRequired` and `receiptsToUpload` still count while they are red.
 */
export function fineCount(summary: Partial<ComplianceSummaryResult> | null | undefined): number {
  const legacy = FINE_FIELDS.reduce((sum, field) => sum + countOf(summary?.[field]), 0);
  const lit = LIT_FINE_FIELDS.reduce((sum, field) => sum + sectionItems(summary, field).filter((item) => lightStateOf(item.light) === 'red').length, 0);
  return legacy + lit;
}
