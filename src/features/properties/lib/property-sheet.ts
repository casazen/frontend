import { requiresItalianCin } from '@/lib/cin-format';
import { pendingLines, type ComplianceLine } from '@/features/compliance/lib/compliance-lines';
import type { PropertyStatus } from '@/lib/status-dictionary';
import type { CinStatus } from '@/types';

/**
 * The tabs of the page of a property (SR-07d). The old page had six (`info`, `photos`, `pricing`, `ical`, `documents`, `cin`)
 * and the dashboard, the wizards and the emails link to them with `?tab=`: those values keep opening the right place.
 * `pricing` is a section of the overview now, `cin` a section of Documenti e adempimenti.
 */
export type PropertyPanel = 'info' | 'photos' | 'activity' | 'ical' | 'documents';

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
  country?: string;
  photoCount: number;
  canWrite: boolean;
  /**
   * The compliance items of the property with the lights the API sent (the police send, the credentials, the tourist tax rate, the months of
   * ISTAT and tax: NF-52, AC-NF52-9), worst first. Missing while they are not read: the step is then the one the property gives, and nothing
   * is told as in order.
   */
  compliance?: readonly ComplianceLine[];
}

export function nextStepOf({ status, cinStatus, country, photoCount, canWrite, compliance }: PropertyNextStepFacts): PropertyNextStepKind {
  if (status === 'Suspended') return 'suspended';
  if (status === 'Pending') return 'completeActivation';
  if (status === 'Paused') return 'reactivate';
  if (requiresItalianCin(country) && cinStatus === 'Missing') return 'cinMissing';
  if (requiresItalianCin(country) && cinStatus === 'Invalid') return 'cinInvalid';
  const pending = pendingLines(compliance ?? []);
  if (pending.some((line) => line.state === 'red')) return 'compliance';
  if (photoCount === 0 && canWrite) return 'addPhotos';
  return pending.length > 0 ? 'compliance' : 'allInOrder';
}

export function complianceLineOf(compliance: readonly ComplianceLine[] | undefined): ComplianceLine | undefined {
  return pendingLines(compliance ?? [])[0];
}

export function mayGiveWayToCompliance(kind: PropertyNextStepKind): boolean {
  return kind === 'allInOrder' || kind === 'addPhotos';
}

export function isActivationStep(kind: PropertyNextStepKind): boolean {
  return kind === 'suspended' || kind === 'completeActivation';
}
