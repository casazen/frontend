import { SERVICE_LIMITS } from '@/features/supplier/services/lib/service-limits';
import { centsToInput, parseEuros } from '@/features/supplier/services/lib/service-money';
import { parseActions, parseWhole } from '@/lib/routine-model';
import { formatCurrency } from '@/lib/utils';
import type { CleaningSetupBulkResponse, Property, PropertyCleanerKind, PropertyCleaningSetup, Routine, SaveCleaningSetupDto } from '@/types';
import type { OrgMember } from '@/types/org-team.types';
import type { SupplierPicker } from '@/types/service-request';

// What the card of the cleaner of a property (E24/F01/US02/T01) and the dialog for many properties know of the contract of `PropertyCleaningSetupController`: the form as a person
// fills it, the limits the server holds it to, the body it sends and how a price is told. Pure: nothing here asks the server.

/** The shortest and the longest a cleaning lasts, in minutes (`CleaningSetupInput`: 5 to 1,440); the default is two hours. */
export const CLEANING_MIN_DURATION = 5;
export const CLEANING_MAX_DURATION = 1440;
export const CLEANING_DEFAULT_DURATION = 120;

/** The most properties the bulk save takes at once (`PropertyCleaningSetupRules.MaxBulkProperties`). */
export const MAX_BULK_PROPERTIES = 200;

/** The category of the suppliers that clean (`GET api/suppliers?category=`). */
export const CLEANING_CATEGORY = 'cleaning';

/** The one currency the suppliers of the marketplace work in: a property in another one takes only a member of the staff (`cleaning_setup_supplier_currency_unsupported`). */
export const SUPPLIER_CURRENCY = 'EUR';

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

/** What a person fills in: texts as typed, parsed only to check and to send. */
export interface CleaningForm {
  kind: PropertyCleanerKind;
  /** The supplier chosen (an org id); empty while none is. */
  supplierOrgId: string;
  /** The member of the staff chosen (`OrgMember.userId`); empty while none is. */
  staffUserId: string;
  /** The agreed price as typed (`45`, `45,50`): in the currency of the property, never a currency of its own. */
  price: string;
  /** `HH:mm`; empty = the check-out time of the property. */
  time: string;
  /** Minutes as typed; empty = two hours. */
  duration: string;
  /** Whether the automation uses the setup. */
  active: boolean;
}

/** What is wrong with a form, by field, as the key of the text that says it. */
export type CleaningProblems = Partial<Record<'cleaner' | 'price' | 'time' | 'duration', string>>;

/** `HH:mm:ss` of the server as an `<input type="time">` takes it (`HH:mm`); empty when there is none. */
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

/** A form filled with the setup the server holds, to change it (what the setup leaves to the default stays empty, so it is not written down as a choice). */
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

/** The price a form holds, in cents: `null` for none (blank) and for what is not an amount. */
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

/**
 * The body of the save for a valid form: only what the kind needs (a supplier never carries a member of the staff, nor the other way round), the price in cents with the currency of the
 * property (a number is never sent without it), the time as `HH:mm:ss` and the length in minutes; what is left empty goes as `null`, which the server reads as the default.
 */
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

/**
 * An amount of money for a person to read, in the currency the data says (`formatCurrency`, never a sign fixed in the code). A currency the data does not say (nothing, or a code that is
 * not one) shows the amount alone, and `currencyKnown` is `false`: the caller says that the currency is missing, and never guesses one.
 */
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

/** Whether the ready routine «Pulizia al check-out» is on, as far as the list of the routines lets the card know. */
export type CleaningRoutineState = 'on' | 'off' | 'unknown';

/**
 * The state of the routine that makes the cleanings, from the list the server answers. A routine acts on every property of the org, so the server shows none of them (it answers an empty list)
 * to who reaches only some of the properties (`GET api/routines`): an empty list does not say «there is none», it says that the card cannot know, and the card does not claim that the routine is off.
 * A list with routines in it is read as it is: one that is on, not in test mode and makes the cleaning is «on», any other list is «off».
 */
export function cleaningRoutineStateOf(routines: readonly Routine[]): CleaningRoutineState {
  if (routines.length === 0) return 'unknown';
  const on = routines.some((routine) => routine.active && !routine.testMode && parseActions(routine.actionsJson).some((action) => action.type === 'CreateCleaningRequest'));
  return on ? 'on' : 'off';
}

/** The name of a member of the staff as the lists of the team write it. */
export function memberName(member: Pick<OrgMember, 'firstName' | 'lastName' | 'email'>): string {
  return `${member.firstName} ${member.lastName}`.trim() || member.email;
}

/** The members who can clean: the active ones, by name. */
export function cleaningStaffOf(members: readonly OrgMember[] | undefined): OrgMember[] {
  return (members ?? [])
    .filter((member) => member.status === 'Active')
    .sort((left, right) => memberName(left).localeCompare(memberName(right)));
}

/** Where the time a cleaning starts at comes from when the setup leaves it empty: the check-out time of the property, or the default time of the server when the property has none. */
export interface CleaningTimeSource {
  kind: 'property' | 'default';
  /** `HH:mm`. */
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
  // The default time is known only while the setup leaves the time empty: with a time of its own the effective one is that time, not the default.
  const effective = toClock(setup.effectiveStartTime);
  return setup.startTime === null && effective !== '' ? { kind: 'default', time: effective } : null;
}

/**
 * What the dialog for many properties knows of one property from the read of its setup: the read is on its way, it failed (the currency is not read), or it says the currency of the property and
 * whether a setup is saved already. The list of the properties carries no currency, so this read is the only source of it.
 */
export type CleaningRead = { state: 'reading' } | { state: 'unread' } | { state: 'known'; currency: string; configured: boolean };

/**
 * The read of a setup as the dialog uses it. A read that failed is never the answer it gave before (the query keeps the old data on an error): the currency is «not read», and nothing is
 * guessed from the old data or from a default. A currency that is not a code of three letters is not read either.
 */
export function cleaningReadOf(read: { isError: boolean; data: PropertyCleaningSetup | undefined }): CleaningRead {
  if (read.isError) return { state: 'unread' };
  if (read.data === undefined) return { state: 'reading' };
  return /^[A-Z]{3}$/.test(read.data.currency) ? { state: 'known', currency: read.data.currency, configured: read.data.configured } : { state: 'unread' };
}

/** The properties that can be set for many at once: the ones the list holds, in the order of their names. */
export function cleaningPropertiesOf(properties: readonly Property[] | undefined): Property[] {
  return [...(properties ?? [])].sort((left, right) => left.name.localeCompare(right.name));
}

/** A supplier that can be chosen, and how many selected properties it serves. */
export interface SupplierChoice {
  hostOrigin?: boolean;
  id: string;
  name: string;
  /** How many of the properties chosen it covers; `null` when the choice is for one property. */
  covers: number | null;
}

/**
 * The suppliers to choose from for a group of properties: one list for each property (`GET api/suppliers?propertyId=&category=cleaning`), put together without repeating a supplier,
 * each with the number of selected properties it serves. A supplier that covers only some of them can still be chosen: the answer of the save says which properties it was refused for.
 */
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

/** What a bulk save came to, from its answer: the properties that were saved and the ones that were not, in the order of the answer. Never «all saved» while one was not. */
export function bulkOutcomeOf(response: CleaningSetupBulkResponse): { saved: string[]; failed: Array<{ propertyId: string; code: string | null; message: string | null }> } {
  return {
    saved: response.results.filter((result) => result.saved).map((result) => result.propertyId),
    failed: response.results.filter((result) => !result.saved).map(({ propertyId, code, message }) => ({ propertyId, code, message })),
  };
}
