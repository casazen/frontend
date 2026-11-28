import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type { ListingChannelStatus, ListingStatus } from '@/types';
import { WIZARD_STEP_IDS, type WizardStepId } from './property-wizard-model';

/**
 * The channels that receive content from CasaZen, by the code of the portal (backend `ListingChannels`: Booking.com, Airbnb, Vrbo). The
 * status only lists the channels a property was published to or is managed on, so these are what a property that was never published can
 * be sent to; any other code in the status is a channel the backend knows and this list does not yet, and is shown all the same.
 */
export const CONTENT_CHANNELS: readonly string[] = ['booking_xml', 'airbnb_xml', 'homeaway'];

export const OCTORATE_MAPPING_PATH = '/app/short-rent/integrations/octorate';

export interface ChannelEntry {
  code: string;
  row: ListingChannelStatus | null;
  managed: boolean;
  selectable: boolean;
}

export function channelEntries(status: ListingStatus | undefined): ChannelEntry[] {
  const rows = new Map((status?.channels ?? []).map((row) => [row.channel, row]));
  const codes = [...CONTENT_CHANNELS, ...[...rows.keys()].filter((code) => !CONTENT_CHANNELS.includes(code))];
  return codes.map((code) => {
    const row = rows.get(code) ?? null;
    const managed = row?.status === 'ManagedOnChannel';
    return { code, row, managed, selectable: !managed };
  });
}

export function selectedChannels(entries: readonly ChannelEntry[], leftOut: readonly string[]): string[] {
  return entries.filter((entry) => entry.selectable && !leftOut.includes(entry.code)).map((entry) => entry.code);
}

const isWizardStep = (step: string): step is WizardStepId => (WIZARD_STEP_IDS as readonly string[]).includes(step);

/** The code of a channel left to fix because the property has no valid CIN, and the step the server files the CIN under (the data of the property). */
const CIN_MISSING_CODE = 'listing_cin_missing';

/** The step where the wizard asks for the CIN: the last one (calendars, CIN, documents), not `base`. */
export const CIN_STEP: WizardStepId = 'finish';

/**
 * The steps of a row that lack data, in the order of the wizard, keeping only the ones this wizard has. The server files the CIN under
 * `base` (it is part of the data of the property) but the wizard asks for it in the last step: while the CIN is not valid (`cinValid`
 * false; unknown = `undefined`, nothing changes) that step is among the ones to fix, and for a channel left to fix for the CIN alone it
 * takes the place of `base`, which has nothing to correct.
 */
export function missingStepsOf(row: Pick<ListingChannelStatus, 'missing' | 'errorCode'>, cinValid?: boolean): WizardStepId[] {
  const found = new Set(row.missing.filter(isWizardStep));
  if (cinValid === false && found.has('base')) {
    found.add(CIN_STEP);
    if (row.errorCode === CIN_MISSING_CODE) found.delete('base');
  }
  return WIZARD_STEP_IDS.filter((id) => found.has(id));
}

export function missingSteps(status: ListingStatus | undefined, cinValid?: boolean): WizardStepId[] {
  const found = new Set((status?.channels ?? []).flatMap((row) => missingStepsOf(row, cinValid)));
  return WIZARD_STEP_IDS.filter((id) => found.has(id));
}

export function importedSteps(status: ListingStatus | undefined, cinValid?: boolean): WizardStepId[] | null {
  if (!status || status.channels.length === 0) return null;
  const wanted = new Set<WizardStepId>([...missingSteps(status, cinValid), 'channels', 'finish']);
  return WIZARD_STEP_IDS.filter((id) => wanted.has(id));
}

/** Where the person fixes a channel: the first step that lacks data (the last one for a CIN that is missing), or the channels when the row says no step. */
export function firstStepToFix(status: ListingStatus | undefined, cinValid?: boolean): WizardStepId {
  return missingSteps(status, cinValid)[0] ?? 'channels';
}

export function canTakeTheirs(groups: readonly string[]): boolean {
  return groups.length > 0 && groups.every((group) => group === 'descriptions');
}

/** What a refused publication says, so that the step can answer it where the person is looking. */
export type PublishProblem =
  | { kind: 'mapping-unconfirmed' }
  | { kind: 'must-import' }
  | { kind: 'modified-outside'; channels: string[] }
  | { kind: 'content-incomplete'; missing: string[] }
  | { kind: 'other'; error: unknown };

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);

export function publishProblemOf(error: unknown): PublishProblem {
  if (!isAxiosError(error)) return { kind: 'other', error };
  const data: unknown = error.response?.data;
  const body = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  switch (getProblemCode(data)) {
    case 'octorate_mapping_unconfirmed':
      return { kind: 'mapping-unconfirmed' };
    case 'octorate_existing_inventory_must_import':
      return { kind: 'must-import' };
    case 'listing_modified_outside':
      return { kind: 'modified-outside', channels: strings(body.channels) };
    case 'listing_content_incomplete':
      return { kind: 'content-incomplete', missing: strings(body.missing) };
    default:
      return { kind: 'other', error };
  }
}
