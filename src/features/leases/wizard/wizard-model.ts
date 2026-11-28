import { parseEuroAmount } from '@/lib/euro-amount';
import { addDays, nightsBetween } from '@/lib/stay-dates';
import { normalizeFiscalCode } from '@/lib/fiscal-code';
import type {
  LandlordDefaults,
  LeaseDraftFlow,
  LeaseDraftParty,
  LeaseDraftValues,
  LeaseFlowStep,
  LeaseNeed,
  LeaseOrigin,
  LongRentRules,
} from '@/types';

export const MAX_PARTIES_PER_ROLE = 10;

export const TRANSITORY_NEED_MAX_LENGTH = 500;
export const TRANSITORY_DOCUMENTATION_MAX_LENGTH = 300;

export const TRANSITORY_PARTIES = ['Landlord', 'Tenant'] as const;

export type DataStep = 1 | 2 | 3 | 4;

export type PartyList = 'landlords' | 'tenants';

export interface PartyRow {
  key: string;
  serverId: string;
  firstName: string;
  lastName: string;
  fiscalCode: string;
  citizenship: string;
  residence: string;
  contactEmail: string;
  contactPhone: string;
}

export interface WizardValues {
  propertyId: string;
  landlords: PartyRow[];
  tenants: PartyRow[];
  contractType: string;
  taxRegime: string;
  monthlyRent: string;
  securityDeposit: string;
  transitoryParty: string;
  transitoryNeed: string;
  startDate: string;
  endDate: string;
  transitoryDocumentation: string;
}

let rowCounter = 0;

export function newPartyRow(from: Partial<Omit<PartyRow, 'key'>> = {}): PartyRow {
  rowCounter += 1;
  return {
    key: `row-${rowCounter}`,
    serverId: '',
    firstName: '',
    lastName: '',
    fiscalCode: '',
    citizenship: '',
    residence: '',
    contactEmail: '',
    contactPhone: '',
    ...from,
  };
}

function rowFromServer(party: LeaseDraftParty): PartyRow {
  return newPartyRow({
    serverId: party.id,
    firstName: party.firstName ?? '',
    lastName: party.lastName ?? '',
    fiscalCode: party.fiscalCode ?? '',
    citizenship: party.citizenship ?? '',
    residence: party.residence ?? '',
    contactEmail: party.contactEmail ?? '',
    contactPhone: party.contactPhone ?? '',
  });
}

function amountText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function dayText(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

export function toWizardValues(values: LeaseDraftValues, defaults?: LandlordDefaults | null): WizardValues {
  const landlords = values.landlords.map(rowFromServer);
  const tenants = values.tenants.map(rowFromServer);
  return {
    propertyId: values.propertyId ?? '',
    landlords:
      landlords.length > 0
        ? landlords
        : [
            newPartyRow({
              firstName: defaults?.firstName ?? '',
              lastName: defaults?.lastName ?? '',
              fiscalCode: defaults?.fiscalCode ?? '',
              residence: defaults?.residence ?? '',
              contactEmail: defaults?.contactEmail ?? '',
            }),
          ],
    tenants: tenants.length > 0 ? tenants : [newPartyRow()],
    contractType: values.contractType ?? '',
    taxRegime: values.taxRegime ?? '',
    monthlyRent: amountText(values.monthlyRent),
    securityDeposit: amountText(values.securityDeposit),
    transitoryParty: values.transitoryParty ?? '',
    transitoryNeed: values.transitoryNeed ?? '',
    startDate: dayText(values.startDate),
    endDate: dayText(values.endDate),
    transitoryDocumentation: values.transitoryDocumentation ?? '',
  };
}

export function isBlankRow(row: PartyRow): boolean {
  return [row.firstName, row.lastName, row.fiscalCode, row.citizenship, row.residence, row.contactEmail, row.contactPhone].every(
    (text) => text.trim() === '',
  );
}

function numberOf(text: string): number | null | undefined {
  if (text.trim() === '') return null;
  const value = parseEuroAmount(text);
  return value === null ? undefined : value;
}

export type SentParties = Record<PartyList, string[]>;

export interface StepPayload {
  values: Record<string, unknown>;
  parties?: SentParties;
}

function partyEntry(row: PartyRow): Record<string, unknown> {
  return {
    ...(row.serverId ? { id: row.serverId } : {}),
    firstName: row.firstName.trim(),
    lastName: row.lastName.trim(),
    fiscalCode: normalizeFiscalCode(row.fiscalCode),
    citizenship: row.citizenship.trim().toUpperCase(),
    residence: row.residence.trim(),
    contactEmail: row.contactEmail.trim(),
    contactPhone: row.contactPhone.trim().replace(/[\s().-]/g, ''),
  };
}

export function stepPayload(step: DataStep, form: WizardValues, origin: LeaseOrigin): StepPayload {
  switch (step) {
    case 1:
      return { values: form.propertyId ? { propertyId: form.propertyId } : {} };
    case 2: {
      const landlords = form.landlords.filter((row) => !isBlankRow(row));
      const tenants = form.tenants.filter((row) => !isBlankRow(row));
      return {
        values: { landlords: landlords.map(partyEntry), tenants: tenants.map(partyEntry) },
        parties: { landlords: landlords.map((row) => row.key), tenants: tenants.map((row) => row.key) },
      };
    }
    case 3: {
      const rent = numberOf(form.monthlyRent);
      const deposit = numberOf(form.securityDeposit);
      return {
        values: {
          contractType: form.contractType || null,
          taxRegime: form.taxRegime || null,
          ...(rent === undefined ? {} : { monthlyRent: rent }),
          ...(deposit === undefined ? {} : { securityDeposit: deposit }),
          ...(makesItsNeed(form, origin)
            ? { transitoryParty: form.transitoryParty || null, transitoryNeed: form.transitoryNeed.trim() || null }
            : {}),
        },
      };
    }
    case 4:
      return {
        values: {
          startDate: form.startDate || null,
          ...(origin === 'Imported' || form.contractType === 'Transitorio' ? { endDate: form.endDate || null } : {}),
          ...(makesItsNeed(form, origin) ? { transitoryDocumentation: form.transitoryDocumentation.trim() || null } : {}),
        },
      };
  }
}

export function makesItsNeed(form: Pick<WizardValues, 'contractType'>, origin: LeaseOrigin): boolean {
  return origin !== 'Imported' && form.contractType === 'Transitorio';
}

export function termDays(start: string, end: string): number {
  const nights = nightsBetween(start, end);
  return nights > 0 ? nights + 1 : 0;
}

export function stepOfField(name: string | undefined): DataStep | null {
  if (!name) return null;
  if (name.endsWith('.serverId') || name.endsWith('.key')) return null;
  const root = name.split('.')[0];
  switch (root) {
    case 'propertyId':
      return 1;
    case 'landlords':
    case 'tenants':
      return 2;
    case 'contractType':
    case 'taxRegime':
    case 'monthlyRent':
    case 'securityDeposit':
    case 'transitoryParty':
    case 'transitoryNeed':
      return 3;
    case 'startDate':
    case 'endDate':
    case 'transitoryDocumentation':
      return 4;
    default:
      return null;
  }
}

export const REVIEW_STEP = 6;

export const SIGN_STEP = 7;

export const AFTER_STEP = 8;

export const DONE_STEP = 'done';

export function registeredSteps(origin: LeaseOrigin): readonly number[] {
  return origin === 'Imported' ? [1, 2, 3, 4, SIGN_STEP, AFTER_STEP] : [1, 2, 3, 4, REVIEW_STEP, SIGN_STEP, AFTER_STEP];
}

export function stepKey(step: number, origin: LeaseOrigin): string {
  return step === SIGN_STEP ? `${step}.${origin}` : String(step);
}

export function isDataStep(step: number): step is DataStep {
  return step >= 1 && step <= 4;
}

export function leaseEditPath(leaseId: string, step?: number | typeof DONE_STEP): string {
  return `/app/long-rent/leases/${leaseId}/edit${step ? `?step=${step}` : ''}`;
}

export function emptyFlow(origin: LeaseOrigin): LeaseDraftFlow {
  return {
    steps: Array.from({ length: 8 }, (_, index) => ({
      step: index + 1,
      state: origin === 'Imported' && (index === 4 || index === 5) ? 'NotApplicable' : 'Todo',
      needs: [],
    })),
  };
}

const TERMS_STEP = 3;

export function reachedStep(draft: { wizardMaxStep: number; values: LeaseDraftValues }): number {
  const { wizardMaxStep: reached, values } = draft;
  if (reached !== TERMS_STEP) return reached;
  const typedBeyondTheType = [values.taxRegime, values.monthlyRent, values.securityDeposit, values.transitoryParty, values.transitoryNeed].some(
    (value) => value !== null && value !== undefined && value !== '',
  );
  return typedBeyondTheType ? reached : TERMS_STEP - 1;
}

export type StepMark = 'current' | 'done' | 'issue' | 'todo' | 'locked';

export function markOf(step: LeaseFlowStep | undefined, current: boolean, visited: boolean): StepMark {
  if (current) return 'current';
  if (step?.state === 'Done') return 'done';
  if (step?.state === 'Locked') return 'locked';
  return visited && (step?.needs.length ?? 0) > 0 ? 'issue' : 'todo';
}

const PROPERTY_FACTS = new Set(['ape_missing', 'ape_identification_missing', 'cadastral_missing']);

export function blockingNeeds(step: LeaseFlowStep | undefined): LeaseNeed[] {
  return (step?.needs ?? []).filter((need) => !PROPERTY_FACTS.has(need.code));
}

export function flowStep(flow: LeaseDraftFlow, step: number): LeaseFlowStep | undefined {
  return flow.steps.find((candidate) => candidate.step === step);
}

export function visibleSteps(flow: LeaseDraftFlow, registered: readonly number[]): number[] {
  return registered.filter((step) => flowStep(flow, step)?.state !== 'NotApplicable').sort((a, b) => a - b);
}

/**
 * Where a contract opens once it was read from its documents (NL-DOCS): the first data step with something missing (the facts of the
 * property aside), else the import of the signed contract. The steps in between have nothing to ask and are walked through with «Avanti».
 */
export function firstStepWithNeeds(flow: LeaseDraftFlow, steps: readonly number[]): number {
  return steps.find((step) => isDataStep(step) && blockingNeeds(flowStep(flow, step)).length > 0) ?? SIGN_STEP;
}

export function firstOpenStep(flow: LeaseDraftFlow, steps: readonly number[]): number {
  const open = steps.find((step) => {
    const state = flowStep(flow, step)?.state;
    return state !== 'Done' && state !== 'Locked';
  });
  return open ?? steps[steps.length - 1] ?? 1;
}

export function stepFromAddress(param: string | null, flow: LeaseDraftFlow, steps: readonly number[]): number {
  const wanted = Number(param);
  if (param !== null && Number.isInteger(wanted) && steps.includes(wanted) && flowStep(flow, wanted)?.state !== 'Locked') return wanted;
  return firstOpenStep(flow, steps);
}

export function fieldIdOfNeed(need: LeaseNeed, form: WizardValues): string | null {
  const params = need.params ?? {};
  const position = (list: PartyList, index: unknown): number => {
    const kept = form[list].map((row, at) => (isBlankRow(row) ? -1 : at)).filter((at) => at >= 0);
    return typeof index === 'number' ? (kept[index] ?? 0) : 0;
  };
  const firstField = (fields: unknown): string => (Array.isArray(fields) && typeof fields[0] === 'string' ? fields[0] : 'firstName');

  switch (need.code) {
    case 'property_missing':
      return 'lw-property';
    case 'ape_missing':
      return 'lw-ape';
    case 'ape_identification_missing':
      return 'lw-ape-identification';
    case 'cadastral_missing':
      return 'lw-cadastral';
    case 'landlord_missing':
      return 'lw-landlords-0-firstName';
    case 'tenant_missing':
      return 'lw-tenants-0-firstName';
    case 'landlord_incomplete':
      return `lw-landlords-${position('landlords', params.index)}-${firstField(params.fields)}`;
    case 'tenant_incomplete':
      return `lw-tenants-${position('tenants', params.index)}-${firstField(params.fields)}`;
    case 'party_fiscal_code_duplicate': {
      const entry = Array.isArray(params.entries) ? (params.entries[0] as { role?: string; index?: number } | undefined) : undefined;
      const list: PartyList = entry?.role === 'Landlord' ? 'landlords' : 'tenants';
      return `lw-${list}-${position(list, entry?.index)}-fiscalCode`;
    }
    case 'contract_type_missing':
    case 'lease_type_not_available':
      return 'lw-type';
    case 'transitory_party_missing':
      return 'lw-transitoryParty';
    case 'transitory_need_missing':
      return 'lw-transitoryNeed';
    case 'transitory_documentation_missing':
    case 'transitory_documentation_too_long':
      return 'lw-transitoryDocumentation';
    case 'tax_regime_missing':
    case 'cedolare_not_allowed_company':
      return 'lw-regime';
    case 'rent_missing':
    case 'rent_invalid':
    case 'rent_out_of_band':
      return 'lw-monthlyRent';
    case 'deposit_missing':
    case 'deposit_invalid':
    case 'deposit_too_high':
      return 'lw-securityDeposit';
    case 'start_missing':
    case 'start_invalid':
      return 'lw-startDate';
    case 'end_missing':
    case 'end_invalid':
    case 'term_out_of_range':
      return 'lw-endDate';
    default:
      return null;
  }
}

export function addMonths(date: string, months: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return '';
  const total = Number(match[1]) * 12 + (Number(match[2]) - 1) + months;
  const year = Math.floor(total / 12);
  const month = total % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(Number(match[3]), lastDay);
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function periodEnd(start: string, months: number): string {
  const end = addMonths(start, months);
  return end ? addDays(end, -1) : '';
}

export function termMonthsOf(rules: LongRentRules | undefined, contractType: string): number | null {
  return rules?.termMonths[contractType] ?? null;
}
