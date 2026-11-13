import { isAxiosError } from 'axios';
import { getHttpStatus, getProblemCode } from '@/lib/api-errors';
import { addDays, isStayDate, nightsBetween } from '@/lib/stay-dates';
import type {
  OwnerCalendarRange,
  OwnerContact,
  OwnerConversationTopicCode,
  OwnerDocument,
  OwnerDocumentVersion,
  OwnerPortalPermission,
  OwnerStatementReference,
  OwnerStay,
  OwnerStayRule,
} from '@/types';
import { OWNER_PORTAL_PERMISSIONS } from '@/types';

// ---------------------------------------------------------------- what a failed read means for a section

/**
 * What a section of the portal says when its read did not come back with data. A refusal is NOT «no access» for the whole app (a person who may read the calendar
 * and not the accounting still has a portal), and never an empty list: each kind says what is true, in the words of the section.
 *
 * - `unavailable`: 404 - the part of the portal is not open yet (or the item does not exist): never «nothing here».
 * - `permission`: 403 `owner_portal_permission_missing` - the owner did not give this permission to the person: the owner is who can change it.
 * - `ownerOnly`: 403 `owner_contact_owner_only` - only an owner manages the contacts.
 * - `forbidden`: any other 403.
 * - `failed`: everything else (no answer, 5xx, an answer that is not the one of the endpoint): can be tried again.
 */
export type OwnerReadState = 'unavailable' | 'permission' | 'ownerOnly' | 'forbidden' | 'failed';

export const OWNER_PERMISSION_MISSING_CODE = 'owner_portal_permission_missing';
export const OWNER_CONTACT_OWNER_ONLY_CODE = 'owner_contact_owner_only';

export function ownerReadStateOf(error: unknown): OwnerReadState {
  const status = getHttpStatus(error);
  if (status === 404) return 'unavailable';
  if (status === 403) {
    const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
    if (code === OWNER_PERMISSION_MISSING_CODE) return 'permission';
    if (code === OWNER_CONTACT_OWNER_ONLY_CODE) return 'ownerOnly';
    return 'forbidden';
  }
  return 'failed';
}

/**
 * What a read holds that may still be drawn: nothing once its last answer was an error. TanStack Query keeps the data of an earlier answer when a later one fails, and a page that
 * draws `data` next to the notice of the refusal would show what the server no longer gives (a document of an access that was withdrawn): a refusal is a refusal (ADR-011-R9).
 */
export function currentData<T>(read: { data: T | undefined; isError: boolean }): T | undefined {
  return read.isError ? undefined : read.data;
}

/** True when the server said that only an owner (not a contact it let in) manages the contacts. */
export function isOwnerOnlyRefusal(error: unknown): boolean {
  return ownerReadStateOf(error) === 'ownerOnly';
}

// ---------------------------------------------------------------- calendar and stays

/** How far the calendar looks: whole months from today, never more than the 366 days the server answers. */
export const CALENDAR_PERIODS = [
  { id: 'threeMonths', days: 90 },
  { id: 'sixMonths', days: 180 },
  { id: 'twelveMonths', days: 364 },
] as const;

export type CalendarPeriodId = (typeof CALENDAR_PERIODS)[number]['id'];

export function calendarWindow(today: string, periodId: CalendarPeriodId): { from: string; to: string } {
  const period = CALENDAR_PERIODS.find((item) => item.id === periodId) ?? CALENDAR_PERIODS[0];
  return { from: today, to: addDays(today, period.days) };
}

/** A run of the calendar as the page draws it: the nights it holds and the kind, both from the server; nothing else is read from the answer. */
export interface CalendarRun {
  key: string;
  start: string;
  end: string;
  nights: number;
  kind: OwnerCalendarRange['kind'];
  stayId: string | null;
  stayState: OwnerCalendarRange['stayState'];
}

/**
 * The runs in the order of the days, with only the members of the contract: whatever else an answer carried (a name, a channel, a note) is dropped here and
 * can never reach a page, and a run with a date that is not a day, or that ends before it starts, is not drawn (it would say something false).
 */
export function calendarRuns(ranges: readonly OwnerCalendarRange[]): CalendarRun[] {
  return ranges
    .filter((range) => isStayDate(range.start) && isStayDate(range.end) && range.end > range.start)
    .map((range) => ({
      key: `${range.kind}-${range.start}-${range.end}`,
      start: range.start,
      end: range.end,
      nights: nightsBetween(range.start, range.end),
      kind: range.kind,
      stayId: range.stayId ?? null,
      stayState: range.stayState ?? null,
    }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : a.end > b.end ? 1 : 0));
}

/** The nights of the calendar by kind: what the summary above it says (the server's runs, summed; the browser decides nothing). */
export function calendarTotals(runs: readonly CalendarRun[]): Record<OwnerCalendarRange['kind'], number> {
  const totals: Record<OwnerCalendarRange['kind'], number> = { available: 0, occupied: 0, blocked: 0, ownerStay: 0 };
  for (const run of runs) totals[run.kind] += run.nights;
  return totals;
}

/** A stay that can be withdrawn: it is still a request, still waiting for its block, confirmed or refused by the channels, and it has not ended. */
export function canCancelStay(stay: Pick<OwnerStay, 'state' | 'endDate'>, today: string): boolean {
  if (stay.state === 'rejected' || stay.state === 'cancelled') return false;
  return stay.endDate > today;
}

/** The checks of the form that cost nothing: the server applies the rules of the agency and answers with the code of the one that is broken. */
export type StayFormProblem = 'datesRequired' | 'endBeforeStart' | 'startInPast';

export function stayFormProblem(startDate: string, endDate: string, today: string): StayFormProblem | null {
  if (!isStayDate(startDate) || !isStayDate(endDate)) return 'datesRequired';
  if (endDate <= startDate) return 'endBeforeStart';
  if (startDate < today) return 'startInPast';
  return null;
}

/** The i18n key and the values of the text a refusal of a stay request gets: the numbers come from the rule the person read above the form. */
export interface StayRefusalText {
  key: string;
  values: Record<string, string | number>;
}

const STAY_REFUSALS: Record<string, (rule: OwnerStayRule | null, year: number | null) => StayRefusalText | null> = {
  owner_stay_too_short: (rule) => (rule ? { key: 'tooShort', values: { nights: rule.minNights } } : null),
  owner_stay_too_long: (rule) => (rule?.maxNights != null ? { key: 'tooLong', values: { nights: rule.maxNights } } : null),
  owner_stay_notice_too_short: (rule) => (rule ? { key: 'noticeTooShort', values: { days: rule.minAdvanceDays } } : null),
  owner_stay_beyond_window: (rule) => (rule?.maxAdvanceDays != null ? { key: 'beyondWindow', values: { days: rule.maxAdvanceDays } } : null),
  owner_stay_allowance_exceeded: (rule, year) =>
    rule?.yearlyNightAllowance != null && year !== null ? { key: 'allowanceExceeded', values: { nights: rule.yearlyNightAllowance, year } } : null,
};

/** The refusal of the server with the numbers of the rule in it, or `null` when the code is not one with a number (the common text of the code applies). */
export function stayRefusalText(error: unknown, rule: OwnerStayRule | null, year: number | null): StayRefusalText | null {
  if (!isAxiosError(error)) return null;
  const code = getProblemCode(error.response?.data);
  if (!code || !Object.hasOwn(STAY_REFUSALS, code)) return null;
  return STAY_REFUSALS[code](rule, year);
}

// ---------------------------------------------------------------- documents and accounting

/** The version a document is read and downloaded as: the one in force, or the newest when none is (an upcoming one, a lapsed one). */
export function primaryVersion(document: Pick<OwnerDocument, 'versions'>): OwnerDocumentVersion | null {
  return document.versions.find((version) => version.state === 'current') ?? document.versions[0] ?? null;
}

/** The versions that are not the primary one, in the order they came (newest first). */
export function otherVersions(document: Pick<OwnerDocument, 'versions'>): OwnerDocumentVersion[] {
  const primary = primaryVersion(document);
  return document.versions.filter((version) => version !== primary);
}

const EXTENSION_OF_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/**
 * The name a file is saved under: the one the agency gave, cleaned of path and control characters, of the signs a file system refuses and of the extensions
 * that came with it, then given the one extension of its type (`fattura.pdf.exe` becomes `fattura_pdf.pdf`). Not the whole word of the server, on purpose.
 */
export function safeDownloadName(fileName: string | null | undefined, contentType: string | null | undefined, fallback: string): string {
  const extension = EXTENSION_OF_TYPE[(contentType ?? '').toLowerCase()] ?? 'pdf';
  const cleaned = Array.from(fileName ?? '')
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      const control = code <= 0x1f || code === 0x7f;
      const direction = code === 0x200e || code === 0x200f || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069);
      return !control && !direction;
    })
    .join('');
  const last = cleaned.split(/[\\/]/).pop() ?? '';
  const stem = last
    .replace(/[<>:"|?*]/g, '_')
    .replace(/\.[A-Za-z0-9]{1,5}$/, '')
    .replace(/\./g, '_')
    .trim()
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return `${stem || fallback}.${extension}`;
}

/** The statement versions the portal shows: only the ones the agency published (and the ones a newer version superseded), the latest period and version first. */
export function visibleStatements(statements: readonly OwnerStatementReference[]): OwnerStatementReference[] {
  return statements
    .filter((statement) => statement.status === 'Published' || statement.status === 'Superseded')
    .sort(
      (a, b) =>
        b.periodYear - a.periodYear || b.periodMonth - a.periodMonth || b.versionNumber - a.versionNumber,
    );
}

/** The documents that are accounting ones (a statement, an invoice): they are listed with the accounting and need `accounting.read` for a contact. */
export function isAccountingDocument(document: Pick<OwnerDocument, 'type'>): boolean {
  return document.type === 'Statement' || document.type === 'Invoice';
}

/**
 * The link of an invoice, only when it is a plain `https` address: anything else (a script, a data address, a file) is not offered as a link. The text of
 * the link never says more than the address does.
 */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- delegated contacts

/** What the owner changes about a contact: a permission in, or out, of the list. The order is always the one of the brief. */
export function togglePermission(
  permissions: readonly OwnerPortalPermission[],
  permission: OwnerPortalPermission,
  granted: boolean,
): OwnerPortalPermission[] {
  const next = new Set(permissions);
  if (granted) next.add(permission);
  else next.delete(permission);
  return OWNER_PORTAL_PERMISSIONS.filter((item) => next.has(item));
}

export function samePermissions(a: readonly OwnerPortalPermission[], b: readonly OwnerPortalPermission[]): boolean {
  return a.length === b.length && OWNER_PORTAL_PERMISSIONS.every((permission) => a.includes(permission) === b.includes(permission));
}

/** A contact whose permissions can still be changed: invited or active. A lapsed or revoked one is a record. */
export function isContactEditable(contact: Pick<OwnerContact, 'status'>): boolean {
  return contact.status === 'active' || contact.status === 'invited';
}

/**
 * A contact that can still be withdrawn: every one that is not withdrawn yet, a lapsed invitation too. For the server a lapsed invitation stays «invited» (it grants nothing, but it counts in the
 * most of 10 contacts of an owner until it is replaced by a new invitation of the same address or withdrawn), so the owner must be able to clear it: with 10 lapsed invitations no new contact could
 * ever be invited.
 */
export function isContactRevocable(contact: Pick<OwnerContact, 'status'>): boolean {
  return contact.status !== 'revoked';
}

/** The first and last name of a contact, or its address when it has neither: what the page calls it. */
export function contactName(contact: Pick<OwnerContact, 'firstName' | 'lastName' | 'email'>): string {
  const name = `${contact.firstName} ${contact.lastName}`.trim();
  return name || contact.email;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An address worth sending to the server: one `@`, no space, a dot after it. The server and the e-mail itself are what really check it. */
export function looksLikeEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

// ---------------------------------------------------------------- inbox

// ---------------------------------------------------------------- inbox topics

/** What a conversation can be about, as the server reads it. */
export const CONVERSATION_TOPICS: readonly OwnerConversationTopicCode[] = ['general', 'property', 'ownerStay', 'document', 'statementVersion'];

/** What the address can ask the form to start with: ids only, never words. A value that is not one of the person's own items is ignored (the select shows nothing chosen). */
export interface NewConversationInitial {
  topic: OwnerConversationTopicCode;
  propertyId: string;
  ownerStayId: string;
  documentId: string;
  statementVersionId: string;
}

/** The start of the form from the search parameters of the address: a topic that is not one of the five is «general». */
export function initialFromSearch(params: URLSearchParams): NewConversationInitial {
  const topic = params.get('topic');
  return {
    topic: CONVERSATION_TOPICS.find((item) => item === topic) ?? 'general',
    propertyId: params.get('propertyId') ?? '',
    ownerStayId: params.get('ownerStayId') ?? '',
    documentId: params.get('documentId') ?? '',
    statementVersionId: params.get('statementVersionId') ?? '',
  };
}


/** The kinds of file a message takes, and their most: the server judges the content (it scans it), this only spares a useless upload. */
export const ATTACHMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export type AttachmentProblem = 'type' | 'size' | 'empty';

export function attachmentProblem(file: Pick<File, 'type' | 'size'>): AttachmentProblem | null {
  if (file.size === 0) return 'empty';
  if (!(ATTACHMENT_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > ATTACHMENT_MAX_BYTES) return 'size';
  return null;
}

/** A size in words a person reads («2,4 MB»), from the bytes the server gave. */
export function formatBytes(bytes: number, locale: string): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KB', 'MB'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}
