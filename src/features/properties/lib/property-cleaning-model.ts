import { SERVICE_LIMITS } from '@/features/supplier/services/lib/service-limits';
import { centsToInput, parseEuros } from '@/features/supplier/services/lib/service-money';
import { parseActions, parseWhole } from '@/lib/routine-model';
import { formatCurrency } from '@/lib/utils';
import type { CleaningSetupBulkResponse, Property, PropertyCleanerKind, PropertyCleaningSetup, Routine, SaveCleaningSetupDto } from '@/types';
import type { OrgMember } from '@/types/org-team.types';
import type { SupplierPicker } from '@/types/service-request';

export const CLEANING_MIN_DURATION = 5;
export const CLEANING_MAX_DURATION = 1440;
export const CLEANING_DEFAULT_DURATION = 120;

export const MAX_BULK_PROPERTIES = 200;

export const CLEANING_CATEGORY = 'cleaning';

export const SUPPLIER_CURRENCY = 'EUR';

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface CleaningForm {
  kind: PropertyCleanerKind;
  supplierOrgId: string;
  staffUserId: string;
  price: string;
  time: string;
  duration: string;
  active: boolean;
}

export type CleaningProblems = Partial<Record<'cleaner' | 'price' | 'time' | 'duration', string>>;

export function toClock(time: string | null | undefined): string {
  const text = time?.slice(0, 5) ?? '';
  return CLOCK.test(text) ? text : '';
}

/** A form for a property that has no setup yet: a supplier when the suppliers can work in the currency of the property, a member of the staff otherwise; on. */
export function emptyCleaningForm(currency: string): CleaningForm {
  return {
    kind: currency === SUPPLIER_CURRENCY ? 'Supplier' : 'Staff',
    supplierOrgId: '',
    staffUserId: '',
    price: '',
    time: '',
    duration: '',
    active: true,
  };
}

export function cleaningFormOf(setup: PropertyCleaningSetup, decimalSeparator: ',' | '.'): CleaningForm {
  if (!setup.configured || setup.cleanerKind === null) return emptyCleaningForm(setup.currency);
  return {
    kind: setup.cleanerKind,
    supplierOrgId: setup.supplierOrgId ?? '',
    staffUserId: setup.staffUserId ?? '',
    price: centsToInput(setup.priceCents, decimalSeparator),
    time: toClock(setup.startTime),
    duration: setup.durationMinutes === null ? '' : String(setup.durationMinutes),
    active: setup.active,
  };
}

export function priceCentsOf(form: Pick<CleaningForm, 'price'>): number | null {
  return parseEuros(form.price).cents;
}

/**
 * What is wrong with the form, so that nothing the API would refuse for its form is sent; the server checks again, and its answer wins. A supplier needs a price from 1 cent, a member of
 * the staff may have none (a price typed must be an amount); the time is a clock time and the length whole minutes from 5 to 1,440.
 */
export function cleaningProblems(form: CleaningForm): CleaningProblems {
  const problems: CleaningProblems = {};

  if (form.kind === 'Supplier' && form.supplierOrgId === '') problems.cleaner = 'propertyCleaning.problem.supplierRequired';
  if (form.kind === 'Staff' && form.staffUserId === '') problems.cleaner = 'propertyCleaning.problem.staffRequired';

  const price = parseEuros(form.price);
  if (price.problem === 'blank') {
    if (form.kind === 'Supplier') problems.price = 'propertyCleaning.problem.priceRequired';
  } else if (price.cents === null) {
    problems.price = 'propertyCleaning.problem.priceInvalid';
  } else if (price.cents < 1 || price.cents > SERVICE_LIMITS.maxAmountCents) {
    problems.price = 'propertyCleaning.problem.priceRange';
  }

  if (form.time !== '' && !CLOCK.test(form.time)) problems.time = 'propertyCleaning.problem.time';

  if (form.duration.trim() !== '') {
    const minutes = parseWhole(form.duration);
    if (minutes === null || minutes < CLEANING_MIN_DURATION || minutes > CLEANING_MAX_DURATION) problems.duration = 'propertyCleaning.problem.duration';
  }

  return problems;
}

export function cleaningDtoOf(form: CleaningForm, currency: string): SaveCleaningSetupDto {
  const cents = priceCentsOf(form);
  const duration = form.duration.trim() === '' ? null : parseWhole(form.duration);
  return {
    cleanerKind: form.kind,
    supplierOrgId: form.kind === 'Supplier' ? form.supplierOrgId : null,
    staffUserId: form.kind === 'Staff' ? form.staffUserId : null,
    priceCents: cents,
    currency: cents === null ? null : currency,
    startTime: form.time === '' ? null : `${form.time}:00`,
    durationMinutes: duration,
    active: form.active,
  };
}

export function formatCleaningPrice(priceCents: number, currency: string | null | undefined, language: string): { text: string; currencyKnown: boolean } {
  const locale = language.toLowerCase().startsWith('en') ? 'en-GB' : 'it-IT';
  const amount = priceCents / 100;
  if (currency && /^[A-Za-z]{3}$/.test(currency)) {
    try {
      return { text: formatCurrency(amount, currency.toUpperCase(), locale), currencyKnown: true };
    } catch {
      // Not a code of a currency: told without one, like a missing one.
    }
  }
  return { text: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount), currencyKnown: false };
}

export type CleaningRoutineState = 'on' | 'off' | 'unknown';

export function cleaningRoutineStateOf(routines: readonly Routine[]): CleaningRoutineState {
  if (routines.length === 0) return 'unknown';
  const on = routines.some((routine) => routine.active && !routine.testMode && parseActions(routine.actionsJson).some((action) => action.type === 'CreateCleaningRequest'));
  return on ? 'on' : 'off';
}

export function memberName(member: Pick<OrgMember, 'firstName' | 'lastName' | 'email'>): string {
  return `${member.firstName} ${member.lastName}`.trim() || member.email;
}

export function cleaningStaffOf(members: readonly OrgMember[] | undefined): OrgMember[] {
  return (members ?? [])
    .filter((member) => member.status === 'Active')
    .sort((left, right) => memberName(left).localeCompare(memberName(right)));
}

export interface CleaningTimeSource {
  kind: 'property' | 'default';
  time: string;
}

/**
 * Where an empty time comes from. The server tells the time a cleaning really starts (`effectiveStartTime`) but not where it comes from: the check-out time of the property, or a default (10:00) when the
 * property has none. The record of the property says which (`checkOutBy`, which may be missing): with a check-out time it is «the check-out time of the property», without one it is the default time the
 * server told, and a record that was not read (`propertyRead` false: still on its way, or failed) says nothing, so the card never gives a source it does not know.
 */
export function cleaningTimeSourceOf(
  setup: Pick<PropertyCleaningSetup, 'startTime' | 'effectiveStartTime'>,
  checkOutBy: string | null | undefined,
  propertyRead: boolean,
): CleaningTimeSource | null {
  if (!propertyRead) return null;
  const checkOut = toClock(checkOutBy);
  if (checkOut !== '') return { kind: 'property', time: checkOut };
  const effective = toClock(setup.effectiveStartTime);
  return setup.startTime === null && effective !== '' ? { kind: 'default', time: effective } : null;
}

export type CleaningRead = { state: 'reading' } | { state: 'unread' } | { state: 'known'; currency: string; configured: boolean };

export function cleaningReadOf(read: { isError: boolean; data: PropertyCleaningSetup | undefined }): CleaningRead {
  if (read.isError) return { state: 'unread' };
  if (read.data === undefined) return { state: 'reading' };
  return /^[A-Z]{3}$/.test(read.data.currency) ? { state: 'known', currency: read.data.currency, configured: read.data.configured } : { state: 'unread' };
}

export function cleaningPropertiesOf(properties: readonly Property[] | undefined): Property[] {
  return [...(properties ?? [])].sort((left, right) => left.name.localeCompare(right.name));
}

export interface SupplierChoice {
  hostOrigin?: boolean;
  id: string;
  name: string;
  covers: number | null;
}

export function supplierChoicesOf(lists: ReadonlyArray<ReadonlyArray<Pick<SupplierPicker, 'orgId' | 'legalName' | 'hostOrigin'>>>, single: boolean): SupplierChoice[] {
  const choices = new Map<string, SupplierChoice>();
  for (const suppliers of lists) {
    for (const supplier of suppliers) {
      const known = choices.get(supplier.orgId);
      choices.set(supplier.orgId, {
        id: supplier.orgId,
        name: supplier.legalName,
        hostOrigin: supplier.hostOrigin,
        covers: single ? null : (known?.covers ?? 0) + 1,
      });
    }
  }
  return [...choices.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export function bulkOutcomeOf(response: CleaningSetupBulkResponse): { saved: string[]; failed: Array<{ propertyId: string; code: string | null; message: string | null }> } {
  return {
    saved: response.results.filter((result) => result.saved).map((result) => result.propertyId),
    failed: response.results.filter((result) => !result.saved).map(({ propertyId, code, message }) => ({ propertyId, code, message })),
  };
}
