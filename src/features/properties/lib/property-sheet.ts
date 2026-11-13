import { pendingLines, type ComplianceLine } from '@/features/compliance/lib/compliance-lines';
import type { PropertyStatus } from '@/lib/status-dictionary';
import type { CinStatus } from '@/types';

/**
 * The tabs of the page of a property (SR-07d). The old page had six (`info`, `photos`, `pricing`, `ical`, `documents`, `cin`)
 * and the dashboard, the wizards and the emails link to them with `?tab=`: those values keep opening the right place.
 * `pricing` is a section of the overview now, `cin` a section of Documenti e adempimenti.
 */
export type PropertyPanel = 'info' | 'photos' | 'activity' | 'ical' | 'documents';

/** The tab a `?tab=` opens: an old or unknown value opens the overview. */
export function propertyPanelOf(value: string | null): PropertyPanel {
  switch (value) {
    case 'photos':
    case 'activity':
    case 'ical':
    case 'documents':
      return value;
    case 'cin':
      return 'documents';
    default:
      return 'info';
  }
}

/** The prices section of the overview: where `?tab=pricing` scrolls to. */
export const PRICING_SECTION_ID = 'property-pricing';

/**
 * What the page asks of the host now, read from what the property already says (its state, the CIN, the photos, the lights of its
 * compliance items), the most pressing first: a suspended or unfinished activation, a pause, a CIN that is missing or wrong, a compliance
 * item the host has to act on, no photo, a compliance item in hand, nothing at all.
 */
export type PropertyNextStepKind =
  | 'suspended'
  | 'completeActivation'
  | 'reactivate'
  | 'cinMissing'
  | 'cinInvalid'
  | 'compliance'
  | 'addPhotos'
  | 'allInOrder';

export interface PropertyNextStepFacts {
  status: PropertyStatus;
  cinStatus: CinStatus;
  /** Photos that can be shown (absolute addresses): a legacy path is no photo. */
  photoCount: number;
  /** The person may write the property: a missing photo is only asked of them, never of who can only read. */
  canWrite: boolean;
  /**
   * The compliance items of the property with the lights the API sent (the police send, the credentials, the tourist tax rate, the months of
   * ISTAT and tax: NF-52, AC-NF52-9), worst first. Missing while they are not read: the step is then the one the property gives, and nothing
   * is told as in order.
   */
  compliance?: readonly ComplianceLine[];
}

export function nextStepOf({ status, cinStatus, photoCount, canWrite, compliance }: PropertyNextStepFacts): PropertyNextStepKind {
  if (status === 'Suspended') return 'suspended';
  if (status === 'Pending') return 'completeActivation';
  if (status === 'Paused') return 'reactivate';
  if (cinStatus === 'Missing') return 'cinMissing';
  if (cinStatus === 'Invalid') return 'cinInvalid';
  const pending = pendingLines(compliance ?? []);
  // What the host has to do for compliance is worth more than a photo; what is only in hand is worth saying when nothing else is asked.
  if (pending.some((line) => line.state === 'red')) return 'compliance';
  if (photoCount === 0 && canWrite) return 'addPhotos';
  return pending.length > 0 ? 'compliance' : 'allInOrder';
}

/** The compliance item the block is about: the worst of the property's that is not in order. */
export function complianceLineOf(compliance: readonly ComplianceLine[] | undefined): ComplianceLine | undefined {
  return pendingLines(compliance ?? [])[0];
}

/**
 * Whether the lights can still take this step away (NF-52): «tutto in ordine» and «aggiungi le foto» give way to a compliance item that is
 * not in order, so the page does not say them until the lights are read (a step that asks something else is said at once).
 */
export function mayGiveWayToCompliance(kind: PropertyNextStepKind): boolean {
  return kind === 'allInOrder' || kind === 'addPhotos';
}

/** The kinds that wait for the activation of the property: the page then reads what is still missing from the server. */
export function isActivationStep(kind: PropertyNextStepKind): boolean {
  return kind === 'suspended' || kind === 'completeActivation';
}
