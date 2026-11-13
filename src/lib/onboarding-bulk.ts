import {
  ONBOARDING_FLOW_KEYS,
  ONBOARDING_FLOW_STATES,
  type BulkFilter,
  type BulkSelection,
  type OnboardingFlowKey,
  type OnboardingFlowState,
} from '@/types/onboarding.types';

/**
 * The rules of the bulk configuration page that are not drawing (E10/F03/US03/T02, NF-105): which selection a person has built, the file of the import, the
 * pages of a long result and the keys of the words of a refusal. It is a page for many properties (250 is the case), where one wrong press touches all of them, so
 * every rule here errs on the side of doing nothing: an empty selection is not «all», a filter with no criterion is nothing, and what is not valid is not sent.
 */

/** How many rows of a result are drawn at once: a list of 1,000 rows and 250 properties never renders whole. */
export const BULK_PAGE_SIZE = 50;

/** The limits of the file of the import (backend `BulkImportLimits`): the page shows them before the person chooses, the server decides. */
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_EXTENSIONS = ['.csv', '.xlsx'] as const;

/** The columns of the file of the import, as the answer names them (backend `BulkImportColumns`): the header of the template. */
export const IMPORT_COLUMNS = ['propertyId', 'cinCode', 'comuneIstatCode', 'regionCode', 'alloggiatiRoomNumbers', 'lockCode'] as const;

/** The template of the import: the header and nothing else, built here (never fetched), so that it holds no data of anyone. */
export function importTemplateCsv(): string {
  return `${IMPORT_COLUMNS.join(',')}\r\n`;
}

/** The name the template is saved as. */
export const IMPORT_TEMPLATE_FILE_NAME = 'strutture-modello.csv';

/** True for a file the page may send: `.csv` or `.xlsx` by its name (any case) and not larger than the limit. The page never opens the file: only its name and its size. */
export function isAcceptedImportFile(file: Pick<File, 'name' | 'size'>): boolean {
  const name = file.name.toLowerCase();
  return IMPORT_EXTENSIONS.some((extension) => name.endsWith(extension)) && file.size > 0 && file.size <= IMPORT_MAX_BYTES;
}

/** What a person types in the filter of a selection: lists of codes written as text, and a flow with one of its states. Nothing is filled in. */
export interface FilterDraft {
  /** ISTAT codes of the comune (6 digits), separated by a comma, a space or a new line. */
  comuni: string;
  /** Region codes (`LOM`). */
  regions: string;
  /** Codes of a channel (`booking_xml`). */
  channels: string;
  flow: OnboardingFlowKey | '';
  flowState: OnboardingFlowState | '';
}

export const EMPTY_FILTER: FilterDraft = { comuni: '', regions: '', channels: '', flow: '', flowState: '' };

/** What is wrong with the filter the person typed, so that the field can say it. */
export type FilterProblem = 'comuni' | 'regions' | 'channels' | 'flowState' | 'none';

/** The most values of one list of a filter (the server refuses more). */
const MAX_VALUES = 500;

const COMUNE_PATTERN = /^\d{6}$/;
const REGION_PATTERN = /^[A-Z]{2,10}$/;
const CHANNEL_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;

/** The values of a list the person typed: split on the usual separators, once each and in the order written. */
function listOf(text: string, normalize: (value: string) => string): string[] {
  const values = text
    .split(/[\s,;]+/)
    .map((value) => normalize(value.trim()))
    .filter((value) => value !== '');
  return Array.from(new Set(values));
}

const FLOW_KEYS: ReadonlySet<string> = new Set(ONBOARDING_FLOW_KEYS);
const FLOW_STATES: ReadonlySet<string> = new Set(ONBOARDING_FLOW_STATES);

/** The selection a person has built, or `null` while there is none that can be sent. */
export interface BuiltSelection {
  selection: BulkSelection | null;
  /** What is wrong with the filter; `null` when nothing is chosen yet or the selection is valid. */
  problem: FilterProblem | null;
}

/**
 * The selection of the page: `all` (asked for by name), or a filter with at least one criterion. Nothing chosen is no selection (the action stays off, it never
 * means «all»), a filter with no criterion is no selection, a list with a value that is not a code is a problem the field says, and a flow without its state (or a
 * state without its flow) is a problem too. The body carries only what the kind uses: a filter never goes with a list of ids.
 */
export function buildSelection(scope: 'all' | 'filter' | null, draft: FilterDraft): BuiltSelection {
  if (scope === null) return { selection: null, problem: null };
  if (scope === 'all') return { selection: { kind: 'all' }, problem: null };

  const comuni = listOf(draft.comuni, (value) => value);
  const regions = listOf(draft.regions, (value) => value.toUpperCase());
  const channels = listOf(draft.channels, (value) => value.toLowerCase());
  if (comuni.length > MAX_VALUES || comuni.some((code) => !COMUNE_PATTERN.test(code))) return { selection: null, problem: 'comuni' };
  if (regions.length > MAX_VALUES || regions.some((code) => !REGION_PATTERN.test(code))) return { selection: null, problem: 'regions' };
  if (channels.length > MAX_VALUES || channels.some((code) => !CHANNEL_PATTERN.test(code))) return { selection: null, problem: 'channels' };

  const hasFlow = draft.flow !== '';
  const hasState = draft.flowState !== '';
  if (hasFlow !== hasState || (hasFlow && !FLOW_KEYS.has(draft.flow)) || (hasState && !FLOW_STATES.has(draft.flowState))) {
    return { selection: null, problem: 'flowState' };
  }

  const filter: BulkFilter = {};
  if (comuni.length > 0) filter.comuneIstatCodes = comuni;
  if (regions.length > 0) filter.regionCodes = regions;
  if (channels.length > 0) filter.channelCodes = channels;
  if (hasFlow && hasState) filter.flowState = { flow: draft.flow as OnboardingFlowKey, state: draft.flowState as OnboardingFlowState };
  if (Object.keys(filter).length === 0) return { selection: null, problem: 'none' };
  return { selection: { kind: 'filter', filter }, problem: null };
}

/** The rows of page `page` (from 1) of a list drawn `BULK_PAGE_SIZE` at a time; a page past the end is the last one. */
export function pageOf<T>(items: readonly T[], page: number, size: number = BULK_PAGE_SIZE): { rows: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  return { rows: items.slice((current - 1) * size, current * size), page: current, pages };
}

const BULK_REASONS: ReadonlySet<string> = new Set([
  'alloggiati_delegation_required',
  'property_not_found',
  'sender_casazen_not_available',
  'sender_channel_manager_not_available',
  'sender_declaration_not_applicable',
  'sender_istat_mismatch',
  'sender_not_applicable',
  'sender_switch_confirmation_required',
]);

/** The words of the reason a property was refused in a bulk apply (`onboardingPlan.bulk.reasons.<code>`); a code this version does not know reads as a neutral line. */
export function bulkReasonKey(reason: string | null | undefined): string {
  return reason && BULK_REASONS.has(reason) ? `onboardingPlan.bulk.reasons.${reason}` : 'onboardingPlan.bulk.reasons.unknown';
}

const IMPORT_ERRORS: ReadonlySet<string> = new Set([
  'comune_unknown',
  'duplicate_row',
  'lock_code_invalid',
  'property_ambiguous',
  'property_not_found',
  'region_mismatch',
  'room_numbers_invalid',
]);

/** The words of an error of a row of the import (`onboardingPlan.bulk.import.errors.<code>`); a code this version does not know reads as a neutral line. */
export function importErrorKey(code: string | null | undefined): string {
  return code && IMPORT_ERRORS.has(code) ? `onboardingPlan.bulk.import.errors.${code}` : 'onboardingPlan.bulk.import.errors.unknown';
}

const IMPORT_COLUMN_NAMES: ReadonlySet<string> = new Set(IMPORT_COLUMNS);

/** The name of a column of the file in plain words (`onboardingPlan.bulk.import.columns.<column>`); a column this version does not know reads as a neutral word. */
export function importColumnKey(column: string | null | undefined): string {
  return column && IMPORT_COLUMN_NAMES.has(column) ? `onboardingPlan.bulk.import.columns.${column}` : 'onboardingPlan.bulk.import.columns.unknown';
}
