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

/**
 * The model of the wizard «Crea contratto»: what the form holds, how a step goes to the server, and how what the server says is
 * missing (`flow`) becomes a place on the screen. Pure functions, no React: the screens and the saver build on them.
 */

/** At most this many landlords, and as many tenants (the limit of the API: 422 `lease_parties_too_many`). */
export const MAX_PARTIES_PER_ROLE = 10;

/**
 * The length of the texts of the need of a transitory contract (TR), as the server states it: the need itself and the documents that
 * prove it. A text longer than that is kept and reported by the server (`transitory_documentation_too_long`), so the fields stop typing
 * at the limit instead.
 */
export const TRANSITORY_NEED_MAX_LENGTH = 500;
export const TRANSITORY_DOCUMENTATION_MAX_LENGTH = 300;

/** Who can have the need that justifies a transitory contract, in the order the cards show them (the names of `PartyRole`). */
export const TRANSITORY_PARTIES = ['Landlord', 'Tenant'] as const;

/** The steps of the data of the contract: the ones that are saved with their values (the server's 1 to 4 here). */
export type DataStep = 1 | 2 | 3 | 4;

export type PartyList = 'landlords' | 'tenants';

/** A landlord or a tenant on the screen. Everything is text, as typed: a half typed value is saved all the same. */
export interface PartyRow {
  /** Names the row on the screen; never sent. */
  key: string;
  /** The id the server gave the entry, once it has one: it goes back with every save, so the entry keeps its row. */
  serverId: string;
  firstName: string;
  lastName: string;
  fiscalCode: string;
  citizenship: string;
  residence: string;
  contactEmail: string;
}

/** What the form holds for the whole wizard. Numbers are the text of the field. */
export interface WizardValues {
  propertyId: string;
  landlords: PartyRow[];
  tenants: PartyRow[];
  contractType: string;
  taxRegime: string;
  monthlyRent: string;
  securityDeposit: string;
  /** The transitory type made here only: who has the need that justifies the short term (`Landlord` or `Tenant`), and what it is. */
  transitoryParty: string;
  transitoryNeed: string;
  startDate: string;
  /** Contracts brought in and the transitory type: the last day of the term, as the contract states it. */
  endDate: string;
  /** The transitory type made here only: the documents that prove the need, asked when the term is long enough. */
  transitoryDocumentation: string;
}

let rowCounter = 0;

/** A row to type in; `from` carries what the server or the landlord data already know. */
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
  });
}

/** A number as the field shows it. */
function amountText(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

/** The day as the field shows it (`yyyy-MM-dd`): the API writes it as it was typed. */
function dayText(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : '';
}

/**
 * The form of a draft read from the server. A role with nobody yet gets an empty row to type in, and the first landlord of a
 * draft that has none starts from the landlord the server suggests (`defaults`), which is saved with the first step.
 */
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

/** A row nobody typed anything in: the server does not keep it either. */
export function isBlankRow(row: PartyRow): boolean {
  return [row.firstName, row.lastName, row.fiscalCode, row.citizenship, row.residence, row.contactEmail].every(
    (text) => text.trim() === '',
  );
}

/** The number written in a field, or `null` for none; `undefined` when what is written is not a number (the field is left out). */
function numberOf(text: string): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

/** What went to the server for the parties of a save: the keys of the rows sent, in order, so the ids of the answer find their rows. */
export type SentParties = Record<PartyList, string[]>;

export interface StepPayload {
  values: Record<string, unknown>;
  /** Set for the step of the parties. */
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
  };
}

/**
 * The values the server saves for a step, from the whole form. Whatever the person typed goes, valid or not (the server keeps it and
 * says what is missing); a value that is not even a number is left out, so what was saved stays.
 */
export function stepPayload(step: DataStep, form: WizardValues, origin: LeaseOrigin): StepPayload {
  switch (step) {
    case 1:
      // A property is chosen, never un-chosen: with none picked there is nothing to send (the step is still counted as gone through).
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
          // The need that justifies a transitory contract made here: who has it and what it is.
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
          // The end is typed for a contract that is already signed and for a transitory one; a libero or a concordato made here has
          // the term of its type.
          ...(origin === 'Imported' || form.contractType === 'Transitorio' ? { endDate: form.endDate || null } : {}),
          // The documents that prove the need of a transitory contract made here (asked when the term is long enough).
          ...(makesItsNeed(form, origin) ? { transitoryDocumentation: form.transitoryDocumentation.trim() || null } : {}),
        },
      };
  }
}

/** A transitory contract made in CasaZen states the need that justifies its term; one already signed prints nothing of its own. */
export function makesItsNeed(form: Pick<WizardValues, 'contractType'>, origin: LeaseOrigin): boolean {
  return origin !== 'Imported' && form.contractType === 'Transitorio';
}

/**
 * The days a term lasts from `start` to the inclusive `end` (both `yyyy-MM-dd`); 0 when either is not a day or the end is not after the
 * start. A transitory contract that lasts more days than `rules.transitoryDocumentationAfterDays` proves its need with documents.
 */
export function termDays(start: string, end: string): number {
  const nights = nightsBetween(start, end);
  return nights > 0 ? nights + 1 : 0;
}

/** The step a field of the form belongs to, from the name RHF gives to a change (`landlords.0.firstName`). */
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

// ---- the flow --------------------------------------------------------------------------------------------------------------

/** The review: the checks of the server and the confirmation. A contract already signed has none. */
export const REVIEW_STEP = 6;

/** The signature: the import of the signed contract («Contratto firmato») for a contract that was signed elsewhere. */
export const SIGN_STEP = 7;

/** What comes after the signature. A signed lease is not a draft any more, so this step is read from the lease and not from the draft. */
export const AFTER_STEP = 8;

/** The address (`?step=done`) of the final screen, «Cosa succede ora». */
export const DONE_STEP = 'done';

/**
 * The steps this wizard has a screen for, by the server's numbers: property, parties, conditions and dates; then, for a contract made
 * in CasaZen, the review (6) and the signature on paper (7); for one already signed, the import of the signed contract (7); and
 * what comes after the signature (8) for both. The model (5) has no screen: nothing in it is required.
 */
export function registeredSteps(origin: LeaseOrigin): readonly number[] {
  return origin === 'Imported' ? [1, 2, 3, 4, SIGN_STEP, AFTER_STEP] : [1, 2, 3, 4, REVIEW_STEP, SIGN_STEP, AFTER_STEP];
}

/** Where the words of a step are in the translations (`leaseWizard.steps.<key>`): the signature reads differently for a contract already signed. */
export function stepKey(step: number, origin: LeaseOrigin): string {
  return step === SIGN_STEP ? `${step}.${origin}` : String(step);
}

export function isDataStep(step: number): step is DataStep {
  return step >= 1 && step <= 4;
}

/** Where a draft is edited, at a step or at the one it opens on (`DONE_STEP` names the final screen). */
export function leaseEditPath(leaseId: string, step?: number | typeof DONE_STEP): string {
  return `/app/long-rent/leases/${leaseId}/edit${step ? `?step=${step}` : ''}`;
}

/** The flow of a contract that does not exist yet: every step still to do (a contract already signed has no model and no review). */
export function emptyFlow(origin: LeaseOrigin): LeaseDraftFlow {
  return {
    steps: Array.from({ length: 8 }, (_, index) => ({
      step: index + 1,
      state: origin === 'Imported' && (index === 4 || index === 5) ? 'NotApplicable' : 'Todo',
      needs: [],
    })),
  };
}

/** The conditions: the step where the type of the contract is saved, whoever has opened it or not. */
const TERMS_STEP = 3;

/**
 * The furthest step the person has reached, as the draft says (`wizardMaxStep`) — except for what the server cannot tell apart: a contract
 * starts with the type chosen in the first question, and that is saved as a save of step ③ before ③ is ever opened, which counts ③ as
 * reached. A draft that stops at ③ with nothing of ③ typed but the type has not been there yet, so ③ is not «Da completare» before it is
 * opened (NL-FLOW-FU1). Only the client can tell: the flow of the server is not changed.
 */
export function reachedStep(draft: { wizardMaxStep: number; values: LeaseDraftValues }): number {
  const { wizardMaxStep: reached, values } = draft;
  if (reached !== TERMS_STEP) return reached;
  const typedBeyondTheType = [values.taxRegime, values.monthlyRent, values.securityDeposit, values.transitoryParty, values.transitoryNeed].some(
    (value) => value !== null && value !== undefined && value !== '',
  );
  return typedBeyondTheType ? reached : TERMS_STEP - 1;
}

/** How a step shows in the list of steps: the one the person is on, done, started and missing something, not started, or not open. */
export type StepMark = 'current' | 'done' | 'issue' | 'todo' | 'locked';

export function markOf(step: LeaseFlowStep | undefined, current: boolean, visited: boolean): StepMark {
  if (current) return 'current';
  if (step?.state === 'Done') return 'done';
  if (step?.state === 'Locked') return 'locked';
  return visited && (step?.needs.length ?? 0) > 0 ? 'issue' : 'todo';
}

/** The needs that are about the property and not about what was typed: they are told, but they do not stop «Avanti». */
const PROPERTY_FACTS = new Set(['ape_missing', 'ape_identification_missing', 'cadastral_missing']);

/** What is missing in a step and has to be done before going on from it. */
export function blockingNeeds(step: LeaseFlowStep | undefined): LeaseNeed[] {
  return (step?.needs ?? []).filter((need) => !PROPERTY_FACTS.has(need.code));
}

export function flowStep(flow: LeaseDraftFlow, step: number): LeaseFlowStep | undefined {
  return flow.steps.find((candidate) => candidate.step === step);
}

/**
 * The steps the person walks through: the ones this wizard has a screen for that apply to the contract (a contract brought in has
 * no model and no review), in order.
 */
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

/** Where a draft opens when the address does not say: the first step that is not done, else the last one. */
export function firstOpenStep(flow: LeaseDraftFlow, steps: readonly number[]): number {
  const open = steps.find((step) => {
    const state = flowStep(flow, step)?.state;
    return state !== 'Done' && state !== 'Locked';
  });
  return open ?? steps[steps.length - 1] ?? 1;
}

/** The step the address names if it is one the person can be on, else the one the draft opens on. */
export function stepFromAddress(param: string | null, flow: LeaseDraftFlow, steps: readonly number[]): number {
  const wanted = Number(param);
  if (param !== null && Number.isInteger(wanted) && steps.includes(wanted) && flowStep(flow, wanted)?.state !== 'Locked') return wanted;
  return firstOpenStep(flow, steps);
}

// ---- where a need is fixed -------------------------------------------------------------------------------------------------

/** `id` of the first field a need points at: «Resta da fare» and a refused «Avanti» put the focus there. */
export function fieldIdOfNeed(need: LeaseNeed, form: WizardValues): string | null {
  const params = need.params ?? {};
  const position = (list: PartyList, index: unknown): number => {
    // The server counts the entries it kept; a blank row of the form is not one of them.
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

// ---- the term, in the words of the summary ---------------------------------------------------------------------------------

/** `date` moved by `months` months, the day of the month kept (or the last day of the month when it does not exist). */
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

/** The last day of a period of `months` months that starts on `start`: «from 1 November for 48 months» ends on 31 October. */
export function periodEnd(start: string, months: number): string {
  const end = addMonths(start, months);
  return end ? addDays(end, -1) : '';
}

/** The months of the first period of a type as the server states them; `null` for a type that has none of its own. */
export function termMonthsOf(rules: LongRentRules | undefined, contractType: string): number | null {
  return rules?.termMonths[contractType] ?? null;
}
