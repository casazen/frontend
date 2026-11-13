import type { OwnerPortalState, OwnerReadinessReport } from '@/types/owner-onboarding.types';

/**
 * The owner step of «Inizia con CasaZen» (E10/F03/US05/T01, NF-109): the page of the owners of an agency, a step the server's plan of eleven parts does not hold
 * (it is client-side, and only for an org on the agency plan whose administrator reads it). Pure rules: what each of the four phases says, the texts of the
 * codes the server sends and the template of the file. Nothing here reads or keeps a value of an owner.
 */

/** The step of the owners, a page of the plan «Inizia con CasaZen». */
export const OWNER_STEP_PATH = '/app/short-rent/onboarding/owners';

/** The «Dati finanziari» of an owner (E06/F05/US02/T04), where what the file does not hold is completed by hand. */
export const ownerFinancialPath = (ownerId: string) => `/app/account/owners/${encodeURIComponent(ownerId)}/financial`;

/** The four phases of the step, in the order the agency does them. */
export const OWNER_PHASES = ['owners', 'shares', 'accounting', 'portal'] as const;
export type OwnerPhase = (typeof OWNER_PHASES)[number];

/** Where a phase stands: nothing there yet, something to complete, or done. */
export type OwnerPhaseState = 'notStarted' | 'toComplete' | 'done';

export const ownerPhaseTitleKey = (phase: OwnerPhase) => `ownerOnboarding.phases.${phase}.title`;
export const ownerPhaseWhatKey = (phase: OwnerPhase) => `ownerOnboarding.phases.${phase}.what`;
export const ownerPhaseStateKey = (state: OwnerPhaseState) => `ownerOnboarding.states.${state}`;

/**
 * The state of each phase, from the counts of the readiness (always complete) and, for the portal, from the states of the owners listed. A phase never
 * reads as done on what is not known: without an owner nothing is ready, and a list cut by the server leaves the portal «to complete» rather than guess.
 */
export function ownerPhaseStates(report: OwnerReadinessReport): Record<OwnerPhase, OwnerPhaseState> {
  const { summary } = report;
  const noOwners = summary.owners === 0;

  const owners: OwnerPhaseState = noOwners ? 'notStarted' : summary.registry.toComplete === 0 ? 'done' : 'toComplete';

  const sharesToComplete = summary.ownership.toComplete + summary.mandate.toComplete + summary.propertiesWithoutOwner + summary.propertiesToComplete;
  const shares: OwnerPhaseState = noOwners ? 'notStarted' : sharesToComplete === 0 ? 'done' : 'toComplete';

  const accounting: OwnerPhaseState = noOwners ? 'notStarted' : summary.fiscalProfile.toComplete + summary.payment.toComplete === 0 ? 'done' : 'toComplete';

  const everyoneAccepted = !report.truncated && report.owners.length === summary.owners && report.owners.every((owner) => owner.portalState === 'accepted');
  const portal: OwnerPhaseState = noOwners ? 'notStarted' : everyoneAccepted ? 'done' : 'toComplete';

  return { owners, shares, accounting, portal };
}

/** The portal states in the order the agency reads them, and their texts. */
export const ownerPortalStateKey = (state: OwnerPortalState) => `ownerOnboarding.portalStates.${state}`;

const PORTAL_STATES: ReadonlySet<string> = new Set<OwnerPortalState>(['notReady', 'ready', 'invited', 'accepted', 'expired', 'revoked']);

/** A portal state this version knows; the server may be newer than the app, and an unknown state reads as «not ready», never as a bare code. */
export function normalizePortalState(state: unknown): OwnerPortalState {
  return typeof state === 'string' && PORTAL_STATES.has(state) ? (state as OwnerPortalState) : 'notReady';
}

/** The facts a readiness reason names (cross-repo contract of the backend, `OwnerReadinessReasons`). Another code is shown as a neutral line. */
const REASON_CODES: ReadonlySet<string> = new Set([
  'legal_name_missing',
  'entity_kind_missing',
  'ownership_missing',
  'shares_gap',
  'shares_shortfall',
  'shares_excess',
  'owner_overlap',
  'mandate_missing',
  'mandate_document_missing',
  'mandate_outside_ownership',
  'tax_residence_missing',
  'fiscal_id_missing',
  'fiscal_code_invalid',
  'vat_number_invalid',
  'billing_address_incomplete',
  'iban_missing',
  'iban_invalid',
  'bic_missing',
  'bic_invalid',
  'settlement_currency_missing',
  'email_missing',
  'email_invalid',
  'registry_not_ready',
  'ownership_not_ready',
]);

const camel = (code: string) => code.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());

/** The key of the text of a reason, or `null` for a code this version has no text for. */
export function ownerReasonKey(code: string): string | null {
  return REASON_CODES.has(code) ? `ownerOnboarding.reasons.${camel(code)}` : null;
}

/** The days where the shares of a property are wrong: the kinds the server names (`gap`, `shortfall`, `excess`, `ownerOverlap`). */
const ISSUE_KINDS: ReadonlySet<string> = new Set(['gap', 'shortfall', 'excess', 'ownerOverlap']);

/** The key of the text of a kind of share problem; a kind this version does not know reads as a neutral line. */
export function ownerIssueKey(kind: string): string {
  return ISSUE_KINDS.has(kind) ? `ownerOnboarding.issues.${kind}` : 'ownerOnboarding.issues.unknown';
}

/** The columns of the owner file a reason can be about (`OwnerImportColumns`): the label of the field the agency has to complete. */
const FIELD_NAMES: ReadonlySet<string> = new Set([
  'propertyId',
  'cinCode',
  'ownerKey',
  'legalName',
  'email',
  'entityKind',
  'taxResidence',
  'fiscalCode',
  'vatNumber',
  'billingStreet',
  'billingCivic',
  'billingPostalCode',
  'billingCity',
  'billingProvince',
  'billingCountry',
  'sharePercent',
  'ownershipStart',
  'ownershipEnd',
  'settlementCurrency',
  'iban',
  'bic',
]);

/** The key of the label of a field, or `null` for a field this version does not know (the line then says only what is missing). */
export function ownerFieldKey(field: string | null | undefined): string | null {
  return field && FIELD_NAMES.has(field) ? `ownerOnboarding.fields.${field}` : null;
}

/** Row errors of the file: the codes of the importer (`OwnerImportRowCodes`) the app has words for. */
const ROW_CODES: ReadonlySet<string> = new Set([
  'property_not_found',
  'property_ambiguous',
  'duplicate_row',
  'owner_identity_missing',
  'owner_key_invalid',
  'owner_not_found',
  'owner_ambiguous',
  'owner_identity_conflict',
  'owner_field_conflict',
  'owner_shared_outside_reach',
  'legal_name_required',
  'legal_name_invalid',
  'entity_kind_invalid',
  'tax_residence_invalid',
  'fiscal_code_invalid',
  'vat_number_invalid',
  'email_invalid',
  'billing_address_invalid',
  'iban_invalid',
  'bic_invalid',
  'currency_invalid',
  'share_invalid',
  'date_invalid',
  'period_invalid',
  'ownership_start_required',
  'ownership_overlap',
  'ownership_period_conflict',
  'ownership_shares_invalid',
  'mandate_outside_ownership',
]);

/** The key of the text of a row code, or `null` for a code this version has no text for. */
export function ownerRowCodeKey(code: string): string | null {
  return ROW_CODES.has(code) ? `ownerOnboarding.rowCodes.${camel(code)}` : null;
}

/** The columns of the owner file in the order of the template: the ones the person fills in, named as the server reads them. */
export const OWNER_TEMPLATE_COLUMNS = [
  'propertyId',
  'cinCode',
  'ownerKey',
  'legalName',
  'email',
  'entityKind',
  'taxResidence',
  'fiscalCode',
  'vatNumber',
  'billingStreet',
  'billingCivic',
  'billingPostalCode',
  'billingCity',
  'billingProvince',
  'billingCountry',
  'sharePercent',
  'ownershipStart',
  'ownershipEnd',
  'settlementCurrency',
  'iban',
  'bic',
] as const;

/** The template of the file: only the header, so it holds no data. Built in the browser; the server is the only one that reads a file. */
export function ownerTemplateCsv(): string {
  return `${OWNER_TEMPLATE_COLUMNS.join(',')}\r\n`;
}

/** The most the server reads from a file: 2 MB (and 1,000 rows: the limits of the import of the per-property data). */
export const OWNER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

/** The file types the import reads: a `.csv` or an `.xlsx`. The server judges the content; the app only refuses what it can tell by the name. */
export function isOwnerImportFileName(name: string): boolean {
  return /\.(csv|xlsx)$/i.test(name);
}

/** How many rows of the result of the check or of the import are shown at a time. */
export const OWNER_IMPORT_PAGE_SIZE = 50;

/** What the form of one owner entered by hand holds (all text as typed): the fields of one row of the file. */
export interface ManualOwnerValues {
  /** The id of the property or its CIN: the form tells them apart. */
  property: string;
  ownerKey: string;
  legalName: string;
  email: string;
  entityKind: string;
  fiscalCode: string;
  sharePercent: string;
  ownershipStart: string;
}

/**
 * The row typed by hand as the confirmation of the import shows it: which property, which owner, what share and from when. Never the tax code or the e-mail, which the
 * confirmation has no need to print again.
 */
export interface ManualOwnerRow {
  property: string;
  owner: string;
  share: string;
  start: string;
}

/** The row of the form as the confirmation names it: the name of the owner, with the code the agency gave it when there is one. */
export function manualOwnerRow(values: ManualOwnerValues): ManualOwnerRow {
  const name = values.legalName.trim();
  const key = values.ownerKey.trim();
  return { property: values.property.trim(), owner: key === '' ? name : `${name} (${key})`, share: values.sharePercent.trim(), start: values.ownershipStart.trim() };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One cell of a CSV: quoted when it holds a separator, a quote or a line break. */
function csvCell(value: string): string {
  const text = value.trim();
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * The owner entered by hand as a one-row file, the way the server reads a file (the header names are the columns of the import): the form builds it in the browser and it
 * goes through the same check and the same confirmed import, so the server is the only judge of the row. A comma in the share is read as the decimal point.
 */
export function ownerManualCsv(values: ManualOwnerValues): string {
  const cells: Array<[string, string]> = [
    [UUID.test(values.property.trim()) ? 'propertyId' : 'cinCode', values.property],
    ['ownerKey', values.ownerKey],
    ['legalName', values.legalName],
    ['email', values.email],
    ['entityKind', values.entityKind],
    ['fiscalCode', values.fiscalCode],
    ['sharePercent', values.sharePercent.replace(',', '.')],
    ['ownershipStart', values.ownershipStart],
  ];
  return `${cells.map(([name]) => name).join(',')}\r\n${cells.map(([, value]) => csvCell(value)).join(',')}\r\n`;
}
