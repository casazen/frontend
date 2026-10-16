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
 * What the page asks of the host now, read from what the property already says (its state, the CIN, the photos), the most
 * pressing first: a suspended or unfinished activation, a pause, a CIN that is missing or wrong, no photo, nothing at all.
 */
export type PropertyNextStepKind =
  | 'suspended'
  | 'completeActivation'
  | 'reactivate'
  | 'cinMissing'
  | 'cinInvalid'
  | 'addPhotos'
  | 'allInOrder';

export interface PropertyNextStepFacts {
  status: PropertyStatus;
  cinStatus: CinStatus;
  /** Photos that can be shown (absolute addresses): a legacy path is no photo. */
  photoCount: number;
  /** The person may write the property: a missing photo is only asked of them, never of who can only read. */
  canWrite: boolean;
}

export function nextStepOf({ status, cinStatus, photoCount, canWrite }: PropertyNextStepFacts): PropertyNextStepKind {
  if (status === 'Suspended') return 'suspended';
  if (status === 'Pending') return 'completeActivation';
  if (status === 'Paused') return 'reactivate';
  if (cinStatus === 'Missing') return 'cinMissing';
  if (cinStatus === 'Invalid') return 'cinInvalid';
  if (photoCount === 0 && canWrite) return 'addPhotos';
  return 'allInOrder';
}

/** The kinds that wait for the activation of the property: the page then reads what is still missing from the server. */
export function isActivationStep(kind: PropertyNextStepKind): boolean {
  return kind === 'suspended' || kind === 'completeActivation';
}
