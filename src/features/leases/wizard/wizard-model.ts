import { normalizeFiscalCode } from '@/lib/fiscal-code';
import type { LandlordDefaults, LeaseDraftFlow, LeaseDraftParty, LeaseDraftValues, LeaseFlowStep, LeaseNeed, LeaseOrigin } from '@/types';

/**
 * The model of the wizard «Crea contratto»: what the form holds, how a step goes to the server, and how what the server says is
 * missing (`flow`) becomes a place on the screen. Pure functions, no React: the screens and the saver build on them.
 */

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
  startDate: string;
  /** Contracts brought in only: the last day of the first period, as the contract states it. */
  endDate: string;
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
    startDate: dayText(values.startDate),
    endDate: dayText(values.endDate),
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
        },
      };
    }
    case 4:
      return {
        values: {
          startDate: form.startDate || null,
          // The end is typed only for a contract that is already signed; a contract made here has the term of its type.
          ...(origin === 'Imported' ? { endDate: form.endDate || null } : {}),
        },
      };
  }
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
      return 3;
    case 'startDate':
    case 'endDate':
      return 4;
    default:
      return null;
  }
}

// ---- the flow --------------------------------------------------------------------------------------------------------------

/**
 * The steps this wizard has a screen for, by the server's numbers: for now the property (1). The parties, the conditions, the dates and
 * the review (2 to 4 and 6) follow in LR-06a-2; the model (5), the signature or the import (7) and what comes after (8) in LR-06b.
 */
export const REGISTERED_STEPS: readonly number[] = [1];

export function isDataStep(step: number): step is DataStep {
  return step >= 1 && step <= 4;
}

/** Where a draft is edited, at a step or at the one it opens on. */
export function leaseEditPath(leaseId: string, step?: number): string {
  return `/app/long-rent/leases/${leaseId}/edit${step ? `?step=${step}` : ''}`;
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
const PROPERTY_FACTS = new Set(['ape_missing', 'cadastral_missing']);

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
    case 'tax_regime_missing':
    case 'cedolare_not_allowed_company':
      return 'lw-regime';
    case 'rent_missing':
    case 'rent_invalid':
    case 'rent_out_of_band':
      return 'lw-monthlyRent';
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
