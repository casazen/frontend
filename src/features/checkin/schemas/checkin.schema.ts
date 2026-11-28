import { z } from 'zod';
import { addInvoiceDataIssues, emptyInvoiceDataForm, hasTypedInvoiceData, invoiceDataFormShape, normalizeInvoiceData } from '@/lib/invoice-data-schema';
import { todayInRome } from '@/lib/stay-dates';
import { isItalianProvince } from '../components/italian-provinces';
import type {
  AlloggiatiDocumentKind,
  AlloggiatiGender,
  PublicCheckInContextDto,
  PublicCheckInGuestPrefill,
  PublicCheckInInvoiceRequest,
  PublicCheckInSubmitRequest,
  StayGuestSubmit,
  StayGuestType,
} from '@/types/public-checkin.types';
import type { InvoiceDataTextField } from '@/types/invoice-data.types';

/** Genders offered to the guest: the only ones Alloggiati Web accepts (1 = male, 2 = female). */
export const ALLOGGIATI_GENDERS = ['Male', 'Female'] as const satisfies readonly AlloggiatiGender[];

/** The five kinds of guest of Alloggiati Web (RS-1), API enum `StayGuestType`. */
export const STAY_GUEST_TYPES = [
  'SingleGuest',
  'HeadOfFamily',
  'HeadOfGroup',
  'FamilyMember',
  'GroupMember',
] as const satisfies readonly StayGuestType[];

export const LEADER_TYPES = ['SingleGuest', 'HeadOfFamily', 'HeadOfGroup'] as const satisfies readonly StayGuestType[];
export type LeaderType = (typeof LEADER_TYPES)[number];

/** Document kinds offered when the official document table is not imported (`Other` has no Alloggiati value). */
export const DOCUMENT_KINDS = ['Passport', 'IdentityCard', 'DriversLicense'] as const satisfies readonly AlloggiatiDocumentKind[];

export const STATISTICAL_GUEST_FIELDS = ['tourismType', 'travelWay', 'educationLevel'] as const;
export type StatisticalGuestField = (typeof STATISTICAL_GUEST_FIELDS)[number];

/**
 * The closed lists of the three fields: CasaZen's own neutral codes (backend `IstatGuestFieldLists`), never the codes of a region. The
 * labels are `checkin.<field>.<code>`; the keys are written out so that the i18n test finds a missing translation.
 */
export const STATISTICAL_FIELD_OPTIONS: Record<StatisticalGuestField, ReadonlyArray<{ code: string; labelKey: string }>> = {
  tourismType: [
    { code: 'holiday', labelKey: 'checkin.tourismType.holiday' },
    { code: 'business', labelKey: 'checkin.tourismType.business' },
    { code: 'other', labelKey: 'checkin.tourismType.other' },
  ],
  travelWay: [
    { code: 'car', labelKey: 'checkin.travelWay.car' },
    { code: 'train', labelKey: 'checkin.travelWay.train' },
    { code: 'plane', labelKey: 'checkin.travelWay.plane' },
    { code: 'bus', labelKey: 'checkin.travelWay.bus' },
    { code: 'ship', labelKey: 'checkin.travelWay.ship' },
    { code: 'other', labelKey: 'checkin.travelWay.other' },
  ],
  educationLevel: [
    { code: 'none', labelKey: 'checkin.educationLevel.none' },
    { code: 'primary', labelKey: 'checkin.educationLevel.primary' },
    { code: 'lower_secondary', labelKey: 'checkin.educationLevel.lower_secondary' },
    { code: 'upper_secondary', labelKey: 'checkin.educationLevel.upper_secondary' },
    { code: 'degree', labelKey: 'checkin.educationLevel.degree' },
    { code: 'postgraduate', labelKey: 'checkin.educationLevel.postgraduate' },
  ],
};

const STATISTICAL_REQUIRED_MESSAGES: Record<StatisticalGuestField, string> = {
  tourismType: 'checkin.validation.tourismType.required',
  travelWay: 'checkin.validation.travelWay.required',
  educationLevel: 'checkin.validation.educationLevel.required',
};

export function requiredStatisticalFields(requiredGuestFields: readonly string[] | null | undefined): StatisticalGuestField[] {
  const wanted = new Set((requiredGuestFields ?? []).map((name) => name.charAt(0).toLowerCase() + name.slice(1)));
  return STATISTICAL_GUEST_FIELDS.filter((field) => wanted.has(field));
}

/** Limits of the Alloggiati record (surname 50, name 30, document number 20) and of CasaZen (guests, labels). */
export const MAX_STAY_GUESTS = 30;
export const MAX_FIRST_NAME_LENGTH = 30;
export const MAX_LAST_NAME_LENGTH = 50;
export const MAX_DOCUMENT_NUMBER_LENGTH = 20;
export const MAX_LABEL_LENGTH = 100;

export const MAX_RESIDENCE_STREET_LENGTH = 200;
export const MAX_RESIDENCE_POSTAL_CODE_LENGTH = 20;
export const MAX_RESIDENCE_CITY_LENGTH = 100;
export const MAX_VEHICLE_PLATE_LENGTH = 20;

const EARLIEST_DOCUMENT_DATE = '1900-01-01';

const DOCUMENT_NUMBER_PATTERN = /^[A-Za-z0-9]+$/;
const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function requiresDocument(type: StayGuestType): boolean {
  return type === 'SingleGuest' || type === 'HeadOfFamily' || type === 'HeadOfGroup';
}

export function officialListIssues(
  guests: readonly StayGuestFormValues[],
  tables: readonly string[],
): { index: number; field: 'citizenshipName' | 'birthComuneName' | 'birthCountryName' | 'documentIssuePlaceName' | 'residenceComuneName' | 'residenceCountryName'; message: string }[] {
  const has = (table: string) => tables.includes(table);
  const issues: { index: number; field: 'citizenshipName' | 'birthComuneName' | 'birthCountryName' | 'documentIssuePlaceName' | 'residenceComuneName' | 'residenceCountryName'; message: string }[] = [];
  guests.forEach((guest, index) => {
    if (has('Stati') && guest.citizenshipName.trim() && !guest.citizenshipCode) {
      issues.push({ index, field: 'citizenshipName', message: 'checkin.validation.citizenship.choose' });
    }
    if (guest.bornInItaly === 'yes' && has('Comuni') && guest.birthComuneName.trim() && !guest.birthComuneCode) {
      issues.push({ index, field: 'birthComuneName', message: 'checkin.validation.birthComune.choose' });
    }
    if (guest.bornInItaly === 'no' && has('Stati') && guest.birthCountryName.trim() && !guest.birthCountryCode) {
      issues.push({ index, field: 'birthCountryName', message: 'checkin.validation.birthCountry.choose' });
    }
    if (requiresDocument(guest.type) && (has('Comuni') || has('Stati')) && guest.documentIssuePlaceName.trim() && !guest.documentIssuePlaceCode) {
      issues.push({ index, field: 'documentIssuePlaceName', message: 'checkin.validation.documentIssuePlace.choose' });
    }
    if (guest.residenceInItaly === 'yes' && has('Comuni') && guest.residenceComuneName.trim() && !guest.residenceComuneCode) {
      issues.push({ index, field: 'residenceComuneName', message: 'checkin.validation.residenceComune.choose' });
    }
    if (guest.residenceInItaly === 'no' && has('Stati') && guest.residenceCountryName.trim() && !guest.residenceCountryCode) {
      issues.push({ index, field: 'residenceCountryName', message: 'checkin.validation.residenceCountry.choose' });
    }
  });
  return issues;
}

export function followerTypeOf(leader: StayGuestType): StayGuestType {
  if (leader === 'HeadOfFamily') return 'FamilyMember';
  if (leader === 'HeadOfGroup') return 'GroupMember';
  return 'SingleGuest';
}

export function isLeaderType(type: StayGuestType): type is LeaderType {
  return (LEADER_TYPES as readonly StayGuestType[]).includes(type);
}

export function isMinorOn(dateOfBirth: string, arrivalDate: string | undefined): boolean | null {
  if (!dateOfBirth || !arrivalDate) return null;
  const birth = dateOfBirth.slice(0, 10);
  const arrival = arrivalDate.slice(0, 10);
  const [by, bm, bd] = birth.split('-').map(Number);
  const [ay, am, ad] = arrival.split('-').map(Number);
  if ([by, bm, bd, ay, am, ad].some((n) => Number.isNaN(n))) return null;
  let age = ay - by;
  if (am < bm || (am === bm && ad < bd)) age -= 1;
  return age < 18;
}

export function normalizeDocumentNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/**
 * The guest fields a property in Switzerland asks on top of the Alloggiati record (NF-132, backend `TicinoCheckInFields`), by the name the form uses.
 * The page asks exactly the ones its `requiredGuestFields` names: the document of every adult and the home (street, postal code, town and the
 * state of residence, all optional).
 */
export const SWISS_GUEST_FIELDS = [
  'documentType',
  'documentNumber',
  'residenceStreet',
  'residencePostalCode',
  'residenceCityName',
  'residenceCountryName',
] as const;
export type SwissGuestField = (typeof SWISS_GUEST_FIELDS)[number];

export const SWISS_HOME_FIELDS = ['residenceStreet', 'residencePostalCode', 'residenceCityName'] as const satisfies readonly SwissGuestField[];
export type SwissHomeField = (typeof SWISS_HOME_FIELDS)[number];

/** What a stay asks of its guests on top of the Alloggiati record: the Swiss fields the regime names and the arrival day, which says who is an adult. */
export interface SwissStayRules {
  readonly asked: ReadonlySet<SwissGuestField>;
  readonly arrivalDate?: string;
}

export const NO_SWISS_RULES: SwissStayRules = { asked: new Set<SwissGuestField>() };

export function swissRulesOf(requiredGuestFields: readonly string[] | null | undefined, arrivalDate?: string | null): SwissStayRules {
  const wanted = new Set((requiredGuestFields ?? []).map((name) => name.charAt(0).toLowerCase() + name.slice(1)));
  const asked = new Set(SWISS_GUEST_FIELDS.filter((field) => wanted.has(field)));
  return asked.size === 0 ? NO_SWISS_RULES : { asked, arrivalDate: arrivalDate ?? undefined };
}

export function asksSwissDocument(rules: SwissStayRules): boolean {
  return rules.asked.has('documentType') || rules.asked.has('documentNumber');
}

export function asksSwissResidence(rules: SwissStayRules): boolean {
  return SWISS_HOME_FIELDS.some((field) => rules.asked.has(field)) || rules.asked.has('residenceCountryName');
}

const GROUP_MIN_SIZE = 6;

function groupLeaderIndex(guests: readonly Pick<StayGuestFormValues, 'type'>[]): number | null {
  if (guests.length < GROUP_MIN_SIZE || guests.some((guest) => guest.type !== 'HeadOfGroup' && guest.type !== 'GroupMember')) return null;
  const leaders = guests.flatMap((guest, index) => (guest.type === 'HeadOfGroup' ? [index] : []));
  return leaders.length === 1 ? leaders[0] : null;
}

export function notifiedGuestIndexes(
  guests: readonly Pick<StayGuestFormValues, 'type' | 'dateOfBirth'>[],
  arrivalDate: string | undefined,
): ReadonlySet<number> {
  const leader = groupLeaderIndex(guests);
  if (leader !== null) return new Set([leader]);

  const aged = guests.flatMap((guest, index) => {
    const minor = isMinorOn(guest.dateOfBirth, arrivalDate);
    return minor === null ? [] : [{ index, adult: !minor }];
  });
  const adults = aged.filter((guest) => guest.adult);
  return new Set((adults.length > 0 ? adults : aged).map((guest) => guest.index));
}

export type DocumentLevel = 'full' | 'basic';

export function documentLevelsOf(
  guests: readonly Pick<StayGuestFormValues, 'type' | 'dateOfBirth'>[],
  swiss: SwissStayRules = NO_SWISS_RULES,
): (DocumentLevel | null)[] {
  const notified = asksSwissDocument(swiss) ? notifiedGuestIndexes(guests, swiss.arrivalDate) : null;
  return guests.map((guest, index) => (requiresDocument(guest.type) ? 'full' : notified?.has(index) ? 'basic' : null));
}

export function normalizeVehiclePlate(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

export function isValidVehiclePlate(value: string): boolean {
  const plate = normalizeVehiclePlate(value);
  return plate === '' || (plate.length <= MAX_VEHICLE_PLATE_LENGTH && /^[\p{L}\p{Nd}-]+$/u.test(plate) && /[\p{L}\p{Nd}]/u.test(plate));
}

/**
 * Every field of one guest of the form. Select values are plain strings (empty = not chosen) so that every conditional check
 * runs in the same pass as the required fields.
 */
const guestShape = {
  type: z.enum(STAY_GUEST_TYPES),
  firstName: z
    .string()
    .trim()
    .min(1, 'checkin.validation.firstName.required')
    .max(MAX_FIRST_NAME_LENGTH, 'checkin.validation.firstName.maxLength'),
  lastName: z
    .string()
    .trim()
    .min(1, 'checkin.validation.lastName.required')
    .max(MAX_LAST_NAME_LENGTH, 'checkin.validation.lastName.maxLength'),
  gender: z.string().refine((value) => (ALLOGGIATI_GENDERS as readonly string[]).includes(value), {
    message: 'checkin.validation.gender.required',
  }),
  dateOfBirth: z.string().min(1, 'checkin.validation.dateOfBirth.required'),
  bornInItaly: z.string().refine((value) => value === 'yes' || value === 'no', {
    message: 'checkin.validation.bornInItaly.required',
  }),
  birthComuneName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  birthComuneCode: z.string().nullable(),
  birthProvince: z.string(),
  birthCountryName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  birthCountryCode: z.string().nullable(),
  citizenshipName: z
    .string()
    .trim()
    .min(1, 'checkin.validation.citizenship.required')
    .max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  citizenshipCode: z.string().nullable(),
  residenceInItaly: z.string(),
  residenceComuneName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  residenceComuneCode: z.string().nullable(),
  residenceProvince: z.string(),
  residenceCountryName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  residenceCountryCode: z.string().nullable(),
  residenceStreet: z.string().max(MAX_RESIDENCE_STREET_LENGTH, 'checkin.validation.residenceStreet.maxLength'),
  residencePostalCode: z.string().max(MAX_RESIDENCE_POSTAL_CODE_LENGTH, 'checkin.validation.residencePostalCode.maxLength'),
  residenceCityName: z.string().max(MAX_RESIDENCE_CITY_LENGTH, 'checkin.validation.label.maxLength'),
  tourismType: z.string(),
  travelWay: z.string(),
  educationLevel: z.string(),
  documentType: z.string(),
  documentTypeCode: z.string().nullable(),
  documentTypeLabel: z.string(),
  documentNumber: z.string(),
  documentNumberOnFile: z.string().nullable(),
  documentIssuePlaceName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  documentIssuePlaceCode: z.string().nullable(),
  documentIssuedOn: z.string(),
  documentExpiresOn: z.string(),
  /**
   * The tourist tax exemption the host chose (a reason code, NF-46), empty for none. It is not a field of the form: the host's wizard
   * holds it to send it back as it received it, because the server takes the list of guests as the whole truth. The guest portal
   * never has it.
   */
  taxExemptionCode: z.string(),
};

export type GuestSchemaScope = 'all' | 'personal' | 'document';

type GuestValues = z.input<z.ZodObject<typeof guestShape>>;

function isValidDay(value: string): boolean {
  return CALENDAR_DAY_PATTERN.test(value);
}

function addPersonalIssues(
  guest: GuestValues,
  required: readonly StatisticalGuestField[],
  issue: (path: string, message: string) => void,
): void {
  if (guest.dateOfBirth && guest.dateOfBirth.slice(0, 10) > todayInRome()) {
    issue('dateOfBirth', 'checkin.validation.dateOfBirth.future');
  }
  if (guest.bornInItaly === 'yes') {
    if (!guest.birthComuneName.trim() && !guest.birthComuneCode) issue('birthComuneName', 'checkin.validation.birthComune.required');
    if (!isItalianProvince(guest.birthProvince)) issue('birthProvince', 'checkin.validation.birthProvince.invalid');
  }
  if (guest.bornInItaly === 'no' && !guest.birthCountryName.trim() && !guest.birthCountryCode) {
    issue('birthCountryName', 'checkin.validation.birthCountry.required');
  }
  if (guest.residenceInItaly === 'yes' && guest.residenceProvince.trim() && !isItalianProvince(guest.residenceProvince)) {
    issue('residenceProvince', 'checkin.validation.residenceProvince.invalid');
  }
  for (const field of required) {
    if (!STATISTICAL_FIELD_OPTIONS[field].some((option) => option.code === guest[field])) {
      issue(field, STATISTICAL_REQUIRED_MESSAGES[field]);
    }
  }
}

function addDocumentKindAndNumberIssues(guest: GuestValues, issue: (path: string, message: string) => void): void {
  if (!guest.documentType && !guest.documentTypeCode) issue('documentType', 'checkin.validation.documentType.required');
  const number = normalizeDocumentNumber(guest.documentNumber);
  if (!number) {
    issue('documentNumber', 'checkin.validation.documentNumber.required');
  } else if (number.length > MAX_DOCUMENT_NUMBER_LENGTH || !DOCUMENT_NUMBER_PATTERN.test(number)) {
    issue('documentNumber', 'checkin.validation.documentNumber.invalid');
  }
}

function addDocumentIssues(guest: GuestValues, issue: (path: string, message: string) => void): void {
  if (!requiresDocument(guest.type)) return;

  addDocumentKindAndNumberIssues(guest, issue);
  if (!guest.documentIssuePlaceName.trim() && !guest.documentIssuePlaceCode) {
    issue('documentIssuePlaceName', 'checkin.validation.documentIssuePlace.required');
  }

  const issued = guest.documentIssuedOn;
  const expires = guest.documentExpiresOn;
  if (issued && (!isValidDay(issued) || issued < EARLIEST_DOCUMENT_DATE)) {
    issue('documentIssuedOn', 'checkin.validation.documentIssuedOn.invalid');
  } else if (issued && issued > todayInRome()) {
    issue('documentIssuedOn', 'checkin.validation.documentIssuedOn.future');
  }
  if (expires && !isValidDay(expires)) {
    issue('documentExpiresOn', 'checkin.validation.documentExpiresOn.invalid');
  } else if (issued && expires && isValidDay(issued) && expires < issued) {
    issue('documentExpiresOn', 'checkin.validation.documentExpiresOn.beforeIssue');
  }
}

export function createStayGuestFormSchema(required: readonly StatisticalGuestField[] = [], scope: GuestSchemaScope = 'all') {
  return z.object(guestShape).superRefine((guest, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (scope !== 'document') addPersonalIssues(guest, required, issue);
    if (scope !== 'personal') addDocumentIssues(guest, issue);
  });
}

export const stayGuestFormSchema = createStayGuestFormSchema();

export type StayGuestFormValues = z.input<typeof stayGuestFormSchema>;

export function compositionIssues(types: readonly StayGuestType[]): { index: number; message: string }[] {
  const issues: { index: number; message: string }[] = [];
  let leader: StayGuestType | null = null;
  let leaderIndex = -1;
  let members = 0;
  const closeLeader = () => {
    if ((leader === 'HeadOfFamily' || leader === 'HeadOfGroup') && members === 0) {
      issues.push({ index: leaderIndex, message: 'checkin.validation.type.headWithoutMembers' });
    }
  };

  types.forEach((type, index) => {
    if (type === 'FamilyMember' || type === 'GroupMember') {
      if (leader !== null && followerTypeOf(leader) === type) members += 1;
      else issues.push({ index, message: 'checkin.validation.type.memberWithoutHead' });
      return;
    }
    closeLeader();
    leader = type;
    leaderIndex = index;
    members = 0;
  });
  closeLeader();
  return issues.sort((a, b) => a.index - b.index);
}

export function createStayGuestListSchema(
  required: readonly StatisticalGuestField[] = [],
  scope: GuestSchemaScope = 'all',
  swiss: SwissStayRules = NO_SWISS_RULES,
) {
  return z
    .array(createStayGuestFormSchema(required, scope))
    .min(1, 'checkin.validation.guests.count')
    .max(MAX_STAY_GUESTS, 'checkin.validation.guests.count')
    .superRefine((guests, ctx) => {
      if (scope !== 'personal') {
        documentLevelsOf(guests, swiss).forEach((level, index) => {
          if (level !== 'basic') return;
          addDocumentKindAndNumberIssues(guests[index], (path, message) => ctx.addIssue({ code: 'custom', path: [index, path], message }));
        });
      }
      if (scope === 'document') return;
      for (const { index, message } of compositionIssues(guests.map((g) => g.type))) {
        ctx.addIssue({ code: 'custom', path: [index, 'type'], message });
      }
    });
}

export const stayVehiclePlateSchema = z.string().refine(isValidVehiclePlate, 'checkin.validation.vehiclePlate.invalid').optional();

/** Host form of the guests of a stay (`PUT /alloggiati/{bookingId}/stay-guests`), with the plate where the regime asks it. */
export function createStayGuestsFormSchema(required: readonly StatisticalGuestField[] = [], swiss: SwissStayRules = NO_SWISS_RULES) {
  return z.object({ guests: createStayGuestListSchema(required, 'all', swiss), vehiclePlate: stayVehiclePlateSchema });
}

export const stayGuestsFormSchema = createStayGuestsFormSchema();

export type StayGuestsFormValues = z.input<typeof stayGuestsFormSchema>;

const SERVER_FIELD_ALIASES: Record<string, keyof StayGuestFormValues> = {
  birthComuneCode: 'birthComuneName',
  birthCountryCode: 'birthCountryName',
  citizenshipCode: 'citizenshipName',
  residenceComuneCode: 'residenceComuneName',
  residenceCountryCode: 'residenceCountryName',
  documentTypeCode: 'documentType',
  documentIssuePlaceCode: 'documentIssuePlaceName',
};

export function guestFormPathOf(serverPath: string, guestCount: number): `guests.${number}.${keyof StayGuestFormValues}` | null {
  const match = /^guests\.(\d+)\.(\w+)$/.exec(serverPath);
  if (!match) return null;
  const index = Number(match[1]);
  if (index >= guestCount) return null;
  const field = SERVER_FIELD_ALIASES[match[2]] ?? match[2];
  return field in guestShape ? `guests.${index}.${field as keyof StayGuestFormValues}` : null;
}

/** The answers to «Ti serve la fattura?» (FIS-01): not answered yet (the step is skipped), yes, or no. */
export const INVOICE_ANSWERS = ['', 'yes', 'no'] as const;

export type InvoiceAnswer = (typeof INVOICE_ANSWERS)[number];

/**
 * The invoice step of the guest page (FIS-01, E06/F02/US03/T02): the answer and, for a «yes», the data of the shared schema
 * (`@/lib/invoice-data-schema`, the same rules as the server). Only a «yes» is checked, and only when the guest wrote something: a «yes» with
 * nothing written leaves the data to the host and never blocks the check-in, as the server accepts it. A «no», or no answer, is not checked at all.
 */
export const invoiceStepSchema = z.object({ answer: z.enum(INVOICE_ANSWERS), ...invoiceDataFormShape }).superRefine((values, context) => {
  if (values.answer === 'yes') addInvoiceDataIssues(values, { requireIdentification: true, onlyWhenTyped: true }, context);
});

export type InvoiceStepValues = z.input<typeof invoiceStepSchema>;

export function emptyInvoiceStep(answer: InvoiceAnswer = ''): InvoiceStepValues {
  return { answer, ...emptyInvoiceDataForm() };
}

export function initialInvoiceStep(context: Pick<PublicCheckInContextDto, 'invoiceRequested' | 'hasInvoiceData'> | undefined): InvoiceStepValues {
  return emptyInvoiceStep(context?.invoiceRequested === true && context.hasInvoiceData !== true ? 'yes' : '');
}

const INVOICE_BLOCK_TEXT_FIELDS = [
  'name',
  'fiscalCode',
  'vatNumber',
  'addressStreet',
  'addressCivic',
  'postalCode',
  'city',
  'province',
  'sdiRecipientCode',
  'pec',
] as const satisfies readonly InvoiceDataTextField[];

/**
 * The `invoice` block of the request, or nothing. Only a «yes» sends one: a guest who skips the step or says no sends no data at all (and the
 * server ignores a «no» anyway). A «yes» with nothing written is the block `{ needInvoice: true }`: the guest wants the invoice and leaves the data
 * to the host. When something is written the block carries the texts that are not empty, normalized as the server stores them, with the kind of
 * recipient and the country: those two alone would ask the server for an identification the guest never saw.
 */
export function toPublicCheckInInvoice(step: InvoiceStepValues | undefined): PublicCheckInInvoiceRequest | undefined {
  if (!step || step.answer !== 'yes') return undefined;
  if (!hasTypedInvoiceData(step)) return { needInvoice: true };

  const data = normalizeInvoiceData(step);
  const block: PublicCheckInInvoiceRequest = { needInvoice: true, recipientKind: data.recipientKind, countryCode: data.countryCode };
  for (const field of INVOICE_BLOCK_TEXT_FIELDS) {
    if (data[field] !== '') block[field] = data[field];
  }
  return block;
}

/**
 * The guest portal form. No consent is asked for the Alloggiati registration (CO-15, A5-15): it is a legal obligation
 * (art. 109 TULPS, art. 6.1.c GDPR) and receipt of the privacy notice is acknowledged separately. The marketing consent is optional (NF-05).
 * `required` lists the statistical fields the region requires (the `requiredGuestFields` of the public view); `swiss` what a property in Switzerland
 * asks on top (NF-132): the document of every adult, whose number has to look like one too, and the plate of the car.
 */
export function createPublicCheckInFormSchema(required: readonly StatisticalGuestField[] = [], swiss: SwissStayRules = NO_SWISS_RULES) {
  return z
    .object({
      guests: createStayGuestListSchema(required, 'all', swiss),
      /** The optional answer to «Ti serve la fattura?» and the data of a «yes» (FIS-01). */
      invoice: invoiceStepSchema.optional(),
      marketingConsentEmail: z.boolean().optional(),
      marketingConsentWhatsApp: z.boolean().optional(),
      marketingEmail: z.string().optional(),
      vehiclePlate: stayVehiclePlateSchema,
    })
    .superRefine((data, ctx) => {
      const levels = documentLevelsOf(data.guests, swiss);
      data.guests.forEach((guest, index) => {
        const number = normalizeDocumentNumber(guest.documentNumber);
        if (levels[index] !== null && number && (number.length < 4 || !/\d/.test(number))) {
          ctx.addIssue({ code: 'custom', path: ['guests', index, 'documentNumber'], message: 'checkin.documentNumberPlausibility' });
        }
      });
      if ((data.marketingConsentEmail || data.marketingConsentWhatsApp) && !data.marketingEmail?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['marketingEmail'],
          message: 'checkin.validation.marketingEmail.required',
        });
      }
      if ((data.marketingConsentEmail || data.marketingConsentWhatsApp) && data.marketingEmail?.trim()) {
        const email = data.marketingEmail.trim();
        if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          ctx.addIssue({
            code: 'custom',
            path: ['marketingEmail'],
            message: 'checkin.validation.marketingEmail.invalid',
          });
        }
      }
    });
}

export const publicCheckInFormSchema = createPublicCheckInFormSchema();

export type PublicCheckInFormValues = z.input<typeof publicCheckInFormSchema>;

export const PUBLIC_CHECKIN_REQUIRED_FIELDS = ['guests'] as const satisfies readonly (keyof PublicCheckInSubmitRequest)[];

export const STAY_GUEST_REQUIRED_FIELDS = [
  'bornInItaly',
  'citizenshipName',
  'dateOfBirth',
  'firstName',
  'gender',
  'lastName',
  'type',
] as const satisfies readonly (keyof StayGuestSubmit)[];

function residenceChoiceOf(prefill: PublicCheckInGuestPrefill | null | undefined): string {
  if (prefill?.residenceInItaly === true) return 'yes';
  if (prefill?.residenceInItaly === false) return 'no';
  return '';
}

export function stayGuestDefaults(type: StayGuestType, prefill?: PublicCheckInGuestPrefill | null): StayGuestFormValues {
  const documentType = prefill?.documentType ?? '';
  return {
    type,
    firstName: prefill?.firstName ?? '',
    lastName: prefill?.lastName ?? '',
    gender: prefill?.gender === 'Male' || prefill?.gender === 'Female' ? prefill.gender : '',
    dateOfBirth: prefill?.dateOfBirth?.slice(0, 10) ?? '',
    bornInItaly: prefill?.bornInItaly === true ? 'yes' : prefill?.bornInItaly === false ? 'no' : '',
    birthComuneName: prefill?.birthComuneName ?? '',
    birthComuneCode: prefill?.birthComuneCode ?? null,
    birthProvince: prefill?.birthProvince ?? '',
    birthCountryName: prefill?.birthCountryName ?? '',
    birthCountryCode: prefill?.birthCountryCode ?? null,
    citizenshipName: prefill?.citizenshipName ?? '',
    citizenshipCode: prefill?.citizenshipCode ?? null,
    residenceInItaly: residenceChoiceOf(prefill),
    residenceComuneName: prefill?.residenceComuneName ?? '',
    residenceComuneCode: prefill?.residenceComuneCode ?? null,
    residenceProvince: prefill?.residenceProvince ?? '',
    residenceCountryName: prefill?.residenceCountryName ?? '',
    residenceCountryCode: prefill?.residenceCountryCode ?? null,
    residenceStreet: prefill?.residenceStreet ?? '',
    residencePostalCode: prefill?.residencePostalCode ?? '',
    residenceCityName: prefill?.residenceCityName ?? '',
    tourismType: prefill?.tourismType ?? '',
    travelWay: prefill?.travelWay ?? '',
    educationLevel: prefill?.educationLevel ?? '',
    documentType: (DOCUMENT_KINDS as readonly string[]).includes(documentType) ? documentType : '',
    documentTypeCode: prefill?.documentTypeCode ?? null,
    documentTypeLabel: prefill?.documentTypeCode ?? '',
    documentNumber: '',
    documentNumberOnFile: prefill?.documentNumberMasked ?? null,
    documentIssuePlaceName: prefill?.documentIssuePlaceName ?? '',
    documentIssuePlaceCode: prefill?.documentIssuePlaceCode ?? null,
    documentIssuedOn: prefill?.documentIssuedOn?.slice(0, 10) ?? '',
    documentExpiresOn: prefill?.documentExpiresOn?.slice(0, 10) ?? '',
    taxExemptionCode: '',
  };
}

export function initialStayGuests(
  prefills: readonly PublicCheckInGuestPrefill[] | undefined,
  declaredGuests: number | undefined,
): StayGuestFormValues[] {
  const declared = Math.min(MAX_STAY_GUESTS, Math.max(1, declaredGuests ?? 1));
  const guests = (prefills ?? []).slice(0, declared).map((prefill) => stayGuestDefaults(prefill.type, prefill));
  if (guests.length === 0) guests.push(stayGuestDefaults(declared > 1 ? 'HeadOfFamily' : 'SingleGuest'));
  if (!isLeaderType(guests[0].type)) guests[0].type = declared > 1 ? 'HeadOfFamily' : 'SingleGuest';
  while (guests.length < declared) guests.push(stayGuestDefaults(followerTypeOf(guests[0].type)));
  return guests;
}

export interface StayGuestSubmitOptions {
  statisticalFields?: readonly StatisticalGuestField[];
  /**
   * The host's entries send the tourist tax exemption they received, because the server takes the list as the whole truth. The guest
   * portal never sends it (it is the host's decision, and the server ignores it there).
   */
  withTaxExemption?: boolean;
  /**
   * The host's entries send back the statistical fields they received, even where the region does not require them, because the server
   * takes the list as the whole truth and a save that left them out would erase them. The guest portal never has this: it sends only the
   * fields the region requires.
   */
  keepStatistical?: boolean;
  /**
   * What a property in Switzerland asks (NF-132): the home (street, postal code, town) is sent, an empty one as `null`, wherever the regime names it,
   * because the server takes the list as the whole truth and a save that left it out would erase it. An Italian stay never has it.
   */
  swiss?: SwissStayRules;
  keepResidenceAddress?: boolean;
  documentLevel?: DocumentLevel | null;
}

function textOrNull(value: string): string | null {
  const text = value.trim();
  return text === '' ? null : text;
}

export function toStayGuestSubmit(values: StayGuestFormValues, options: StayGuestSubmitOptions = {}): StayGuestSubmit {
  const bornInItaly = values.bornInItaly === 'yes';
  const withDocument = options.documentLevel === undefined ? requiresDocument(values.type) : options.documentLevel !== null;
  const residenceInItaly = values.residenceInItaly === 'yes' ? true : values.residenceInItaly === 'no' ? false : null;
  const statistical = options.statisticalFields ?? [];
  const sends = (field: StatisticalGuestField) =>
    statistical.includes(field) || (options.keepStatistical === true && textOrNull(values[field]) !== null);
  const sendsHome = (field: SwissHomeField) =>
    options.swiss?.asked.has(field) === true || (options.keepResidenceAddress === true && textOrNull(values[field]) !== null);
  return {
    type: values.type,
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    gender: values.gender as AlloggiatiGender,
    dateOfBirth: values.dateOfBirth,
    bornInItaly,
    birthComuneName: bornInItaly ? values.birthComuneName.trim() : '',
    birthComuneCode: bornInItaly ? values.birthComuneCode : null,
    birthProvince: bornInItaly ? values.birthProvince.trim().toUpperCase() : null,
    birthCountryName: bornInItaly ? '' : values.birthCountryName.trim(),
    birthCountryCode: bornInItaly ? null : values.birthCountryCode,
    citizenshipName: values.citizenshipName.trim(),
    citizenshipCode: values.citizenshipCode,
    documentType: withDocument && values.documentType ? values.documentType : null,
    documentTypeCode: withDocument ? values.documentTypeCode : null,
    documentNumber: withDocument ? normalizeDocumentNumber(values.documentNumber) : null,
    documentIssuePlaceName: withDocument ? values.documentIssuePlaceName.trim() : null,
    documentIssuePlaceCode: withDocument ? values.documentIssuePlaceCode : null,
    documentIssuedOn: withDocument && values.documentIssuedOn ? values.documentIssuedOn : null,
    documentExpiresOn: withDocument && values.documentExpiresOn ? values.documentExpiresOn : null,
    residenceInItaly,
    residenceComuneName: residenceInItaly === true ? textOrNull(values.residenceComuneName) : null,
    residenceComuneCode: residenceInItaly === true ? values.residenceComuneCode : null,
    residenceProvince: residenceInItaly === true ? textOrNull(values.residenceProvince)?.toUpperCase() ?? null : null,
    residenceCountryName: residenceInItaly === false ? textOrNull(values.residenceCountryName) : null,
    residenceCountryCode: residenceInItaly === false ? values.residenceCountryCode : null,
    ...(sendsHome('residenceStreet') ? { residenceStreet: textOrNull(values.residenceStreet) } : {}),
    ...(sendsHome('residencePostalCode') ? { residencePostalCode: textOrNull(values.residencePostalCode) } : {}),
    ...(sendsHome('residenceCityName') ? { residenceCityName: textOrNull(values.residenceCityName) } : {}),
    ...(sends('tourismType') ? { tourismType: textOrNull(values.tourismType) } : {}),
    ...(sends('travelWay') ? { travelWay: textOrNull(values.travelWay) } : {}),
    ...(sends('educationLevel') ? { educationLevel: textOrNull(values.educationLevel) } : {}),
    ...(options.withTaxExemption ? { taxExemptionCode: textOrNull(values.taxExemptionCode) } : {}),
  };
}

export function toStayGuestSubmits(guests: readonly StayGuestFormValues[], options: StayGuestSubmitOptions = {}): StayGuestSubmit[] {
  const levels = documentLevelsOf(guests, options.swiss);
  return guests.map((guest, index) => toStayGuestSubmit(guest, { ...options, documentLevel: levels[index] }));
}

/**
 * The plate a host's entry sends with the guests (NF-132): the plate as the API stores it, an empty one to clear it, and nothing (`undefined`)
 * when the form does not ask for a plate, so that the stored one stays.
 */
export function hostVehiclePlateOf(values: { vehiclePlate?: string }): string | undefined {
  return values.vehiclePlate === undefined ? undefined : normalizeVehiclePlate(values.vehiclePlate);
}

export function toPublicCheckInSubmitRequest(
  values: PublicCheckInFormValues,
  options: Pick<StayGuestSubmitOptions, 'statisticalFields' | 'swiss'> = {},
): PublicCheckInSubmitRequest {
  const invoice = toPublicCheckInInvoice(values.invoice);
  const vehiclePlate = normalizeVehiclePlate(values.vehiclePlate ?? '');
  return {
    guests: toStayGuestSubmits(values.guests, options),
    marketingConsentEmail: values.marketingConsentEmail ?? false,
    marketingConsentWhatsApp: values.marketingConsentWhatsApp ?? false,
    marketingEmail: values.marketingEmail?.trim() || null,
    ...(invoice ? { invoice } : {}),
    ...(vehiclePlate ? { vehiclePlate } : {}),
  };
}
