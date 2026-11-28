import type { OwnerPortalState, OwnerReadinessReport, OwnerReadinessSummary } from '@/types/owner-onboarding.types';

export const OWNER_STEP_PATH = '/app/short-rent/onboarding/owners';

export const ownerFinancialPath = (ownerId: string) => `/app/account/owners/${encodeURIComponent(ownerId)}/financial`;

export const OWNER_PHASES = ['owners', 'shares', 'accounting', 'portal'] as const;
export type OwnerPhase = (typeof OWNER_PHASES)[number];

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

/**
 * How many facts the owner accounting still waits for, as the step of the plan says it: the owners that are not ready for each dimension (the registry, the ownership, the mandate, the
 * fiscal profile and the payment data) plus the properties with no owner or with shares that are wrong, the same things the phases of the page count. It is zero only when there is nothing
 * to complete (`summary.financialReady`) or there is no owner at all, so the line of the step never says «0» beside a badge that says «to complete».
 */
export function ownerFactsToComplete(summary: OwnerReadinessSummary): number {
  return (
    summary.registry.toComplete +
    summary.ownership.toComplete +
    summary.mandate.toComplete +
    summary.fiscalProfile.toComplete +
    summary.payment.toComplete +
    summary.propertiesWithoutOwner +
    summary.propertiesToComplete
  );
}

export const ownerPortalStateKey = (state: OwnerPortalState) => `ownerOnboarding.portalStates.${state}`;

const PORTAL_STATES: ReadonlySet<string> = new Set<OwnerPortalState>(['notReady', 'ready', 'invited', 'accepted', 'expired', 'revoked']);

export function normalizePortalState(state: unknown): OwnerPortalState {
  return typeof state === 'string' && PORTAL_STATES.has(state) ? (state as OwnerPortalState) : 'notReady';
}

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

export function ownerReasonKey(code: string): string | null {
  return REASON_CODES.has(code) ? `ownerOnboarding.reasons.${camel(code)}` : null;
}

const ISSUE_KINDS: ReadonlySet<string> = new Set(['gap', 'shortfall', 'excess', 'ownerOverlap']);

export function ownerIssueKey(kind: string): string {
  return ISSUE_KINDS.has(kind) ? `ownerOnboarding.issues.${kind}` : 'ownerOnboarding.issues.unknown';
}

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

export function ownerFieldKey(field: string | null | undefined): string | null {
  return field && FIELD_NAMES.has(field) ? `ownerOnboarding.fields.${field}` : null;
}

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

export function ownerRowCodeKey(code: string): string | null {
  return ROW_CODES.has(code) ? `ownerOnboarding.rowCodes.${camel(code)}` : null;
}

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

export function ownerTemplateCsv(): string {
  return `${OWNER_TEMPLATE_COLUMNS.join(',')}\r\n`;
}

export const OWNER_IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export function isOwnerImportFileName(name: string): boolean {
  return /\.(csv|xlsx)$/i.test(name);
}

export const OWNER_IMPORT_PAGE_SIZE = 50;

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

export interface ManualOwnerRow {
  property: string;
  owner: string;
  share: string;
  start: string;
}

export function manualOwnerRow(values: ManualOwnerValues): ManualOwnerRow {
  const name = values.legalName.trim();
  const key = values.ownerKey.trim();
  return { property: values.property.trim(), owner: key === '' ? name : `${name} (${key})`, share: values.sharePercent.trim(), start: values.ownershipStart.trim() };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function csvCell(value: string): string {
  const text = value.trim();
  return /[",;\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

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
