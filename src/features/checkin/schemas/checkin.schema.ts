import { z } from 'zod';
import { todayInRome } from '@/lib/stay-dates';
import type {
  AlloggiatiDocumentKind,
  AlloggiatiGender,
  PublicCheckInGuestPrefill,
  PublicCheckInSubmitRequest,
  StayGuestSubmit,
  StayGuestType,
} from '@/types/public-checkin.types';

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

/** Kinds that open a unit of the stay (and carry the document): the first guest is always one of these. */
export const LEADER_TYPES = ['SingleGuest', 'HeadOfFamily', 'HeadOfGroup'] as const satisfies readonly StayGuestType[];
export type LeaderType = (typeof LEADER_TYPES)[number];

/** Document kinds offered when the official document table is not imported (`Other` has no Alloggiati value). */
export const DOCUMENT_KINDS = ['Passport', 'IdentityCard', 'DriversLicense'] as const satisfies readonly AlloggiatiDocumentKind[];

/**
 * The three statistical fields of a guest (NF-40), by the name the form and the API use. They are asked only where the region of the
 * property requires them (`requiredGuestFields` of the public view): a field the region does not require is neither shown nor sent.
 */
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

/** The message of a required statistical field that was not chosen (an i18n key, written out for the i18n test). */
const STATISTICAL_REQUIRED_MESSAGES: Record<StatisticalGuestField, string> = {
  tourismType: 'checkin.validation.tourismType.required',
  travelWay: 'checkin.validation.travelWay.required',
  educationLevel: 'checkin.validation.educationLevel.required',
};

/**
 * The statistical fields of the form that the API asks for, from its `requiredGuestFields` (`TourismType`, `TravelWay`,
 * `EducationLevel`; the camelCase spelling is accepted too). A name the form does not know is ignored.
 */
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

/** The oldest day a document can have been issued (the API refuses an earlier one). */
const EARLIEST_DOCUMENT_DATE = '1900-01-01';

const PROVINCE_PATTERN = /^[A-Za-z]{2}$/;
const DOCUMENT_NUMBER_PATTERN = /^[A-Za-z0-9]+$/;
const CALENDAR_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Single guests and heads of family or group carry the identity document; family and group members do not. */
export function requiresDocument(type: StayGuestType): boolean {
  return type === 'SingleGuest' || type === 'HeadOfFamily' || type === 'HeadOfGroup';
}

/** Kind of the guests added after the first one: members of the family or group, or other single guests. */
export function followerTypeOf(leader: StayGuestType): StayGuestType {
  if (leader === 'HeadOfFamily') return 'FamilyMember';
  if (leader === 'HeadOfGroup') return 'GroupMember';
  return 'SingleGuest';
}

export function isLeaderType(type: StayGuestType): type is LeaderType {
  return (LEADER_TYPES as readonly StayGuestType[]).includes(type);
}

/** True when the guest is under 18 on the arrival date; null without both dates. */
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

/** Document number as the record wants it: no spaces, uppercase. */
export function normalizeDocumentNumber(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
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
  /** Residence (NF-40, optional): `yes` in Italy (comune and province), `no` abroad (state), empty when not said. */
  residenceInItaly: z.string(),
  residenceComuneName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  residenceComuneCode: z.string().nullable(),
  residenceProvince: z.string(),
  residenceCountryName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  residenceCountryCode: z.string().nullable(),
  /** The statistical fields (NF-40): a code of the closed list, empty when not chosen. Asked only where the region requires them. */
  tourismType: z.string(),
  travelWay: z.string(),
  educationLevel: z.string(),
  documentType: z.string(),
  documentTypeCode: z.string().nullable(),
  /** Label of the chosen official document type (form only, not sent). */
  documentTypeLabel: z.string(),
  documentNumber: z.string(),
  /** Masked number already on file (`*****567`), shown as a hint (form only, not sent). */
  documentNumberOnFile: z.string().nullable(),
  documentIssuePlaceName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
  documentIssuePlaceCode: z.string().nullable(),
  /** Issue and expiry days of the document (`YYYY-MM-DD`, NF-40, optional): empty when not given. */
  documentIssuedOn: z.string(),
  documentExpiresOn: z.string(),
  /**
   * The tourist tax exemption the host chose (a reason code, NF-46), empty for none. It is not a field of the form: the host's wizard
   * holds it to send it back as it received it, because the server takes the list of guests as the whole truth. The guest portal
   * never has it.
   */
  taxExemptionCode: z.string(),
};

/** Which rules a schema of a guest checks: everything, only the personal data, or only the identity document. */
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
    if (!PROVINCE_PATTERN.test(guest.birthProvince.trim())) issue('birthProvince', 'checkin.validation.birthProvince.invalid');
  }
  if (guest.bornInItaly === 'no' && !guest.birthCountryName.trim() && !guest.birthCountryCode) {
    issue('birthCountryName', 'checkin.validation.birthCountry.required');
  }
  // The residence is optional: only its shape is checked (a province, when given, is two letters).
  if (guest.residenceInItaly === 'yes' && guest.residenceProvince.trim() && !PROVINCE_PATTERN.test(guest.residenceProvince.trim())) {
    issue('residenceProvince', 'checkin.validation.residenceProvince.invalid');
  }
  // A statistical field is asked only where the region requires it, and then it has to be chosen.
  for (const field of required) {
    if (!STATISTICAL_FIELD_OPTIONS[field].some((option) => option.code === guest[field])) {
      issue(field, STATISTICAL_REQUIRED_MESSAGES[field]);
    }
  }
}

function addDocumentIssues(guest: GuestValues, issue: (path: string, message: string) => void): void {
  if (!requiresDocument(guest.type)) return;

  if (!guest.documentType && !guest.documentTypeCode) issue('documentType', 'checkin.validation.documentType.required');
  const number = normalizeDocumentNumber(guest.documentNumber);
  if (!number) {
    issue('documentNumber', 'checkin.validation.documentNumber.required');
  } else if (number.length > MAX_DOCUMENT_NUMBER_LENGTH || !DOCUMENT_NUMBER_PATTERN.test(number)) {
    issue('documentNumber', 'checkin.validation.documentNumber.invalid');
  }
  if (!guest.documentIssuePlaceName.trim() && !guest.documentIssuePlaceCode) {
    issue('documentIssuePlaceName', 'checkin.validation.documentIssuePlace.required');
  }

  // The dates are optional: the issue day is a real day, not in the future and not before 1900, the expiry is not before the issue.
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

/**
 * The schema of one guest of the form. `required` lists the statistical fields the region requires (they have to be chosen; the others
 * are not asked and nothing else becomes mandatory). `scope` lets a wizard check the personal data and the document one step at a time.
 */
export function createStayGuestFormSchema(required: readonly StatisticalGuestField[] = [], scope: GuestSchemaScope = 'all') {
  return z.object(guestShape).superRefine((guest, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
    if (scope !== 'document') addPersonalIssues(guest, required, issue);
    if (scope !== 'personal') addDocumentIssues(guest, issue);
  });
}

/** One guest of the form, with no statistical field required. */
export const stayGuestFormSchema = createStayGuestFormSchema();

export type StayGuestFormValues = z.input<typeof stayGuestFormSchema>;

/**
 * Order of the guests (RS-1): a family member follows its head of family, a group member its head of group, and a head
 * has at least one member. The error goes on the kind of the guest at fault.
 */
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

/** Every guest of the stay, in record order, with the order checked. */
export function createStayGuestListSchema(required: readonly StatisticalGuestField[] = [], scope: GuestSchemaScope = 'all') {
  return z
    .array(createStayGuestFormSchema(required, scope))
    .min(1, 'checkin.validation.guests.count')
    .max(MAX_STAY_GUESTS, 'checkin.validation.guests.count')
    .superRefine((guests, ctx) => {
      if (scope === 'document') return;
      for (const { index, message } of compositionIssues(guests.map((g) => g.type))) {
        ctx.addIssue({ code: 'custom', path: [index, 'type'], message });
      }
    });
}

/** Host form of the guests of a stay (`PUT /alloggiati/{bookingId}/stay-guests`). */
export const stayGuestsFormSchema = z.object({ guests: createStayGuestListSchema() });

export type StayGuestsFormValues = z.input<typeof stayGuestsFormSchema>;

/** Server fields shown on another input of the form: a code on the input of its name. */
const SERVER_FIELD_ALIASES: Record<string, keyof StayGuestFormValues> = {
  birthComuneCode: 'birthComuneName',
  birthCountryCode: 'birthCountryName',
  citizenshipCode: 'citizenshipName',
  residenceComuneCode: 'residenceComuneName',
  residenceCountryCode: 'residenceCountryName',
  documentTypeCode: 'documentType',
  documentIssuePlaceCode: 'documentIssuePlaceName',
};

/**
 * Form path of a server field error of a guest (`guests.1.documentTypeCode` → `guests.1.documentType`), or null when
 * the path is not a field of an existing guest.
 */
export function guestFormPathOf(serverPath: string, guestCount: number): `guests.${number}.${keyof StayGuestFormValues}` | null {
  const match = /^guests\.(\d+)\.(\w+)$/.exec(serverPath);
  if (!match) return null;
  const index = Number(match[1]);
  if (index >= guestCount) return null;
  const field = SERVER_FIELD_ALIASES[match[2]] ?? match[2];
  return field in guestShape ? `guests.${index}.${field as keyof StayGuestFormValues}` : null;
}

/**
 * The guest portal form. No consent is asked for the Alloggiati registration (CO-15, A5-15): it is a legal obligation
 * (art. 109 TULPS, art. 6.1.c GDPR) and the privacy notice is only shown. The marketing consent is optional (NF-05).
 * `required` lists the statistical fields the region requires (the `requiredGuestFields` of the public view).
 */
export function createPublicCheckInFormSchema(required: readonly StatisticalGuestField[] = []) {
  return z
    .object({
      guests: createStayGuestListSchema(required),
      /** Guest ticked the email marketing channel (NF-05). */
      marketingConsentEmail: z.boolean().optional(),
      /** Guest ticked the WhatsApp marketing channel (NF-05). */
      marketingConsentWhatsApp: z.boolean().optional(),
      /** Marketing email address (required when any channel is ticked, NF-05). */
      marketingEmail: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      // Marketing email is required when any channel is ticked (NF-05).
      if ((data.marketingConsentEmail || data.marketingConsentWhatsApp) && !data.marketingEmail?.trim()) {
        ctx.addIssue({
          code: 'custom',
          path: ['marketingEmail'],
          message: 'checkin.validation.marketingEmail.required',
        });
      }
      // Validate email format when provided.
      if (data.marketingEmail?.trim()) {
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

/** The guest portal form of a region that requires no statistical field. */
export const publicCheckInFormSchema = createPublicCheckInFormSchema();

export type PublicCheckInFormValues = z.input<typeof publicCheckInFormSchema>;

/**
 * `[Required]` properties of the API DTOs `PublicCheckInSubmitRequest` and `StayGuestSubmitDto`
 * (`Casazen.Web/DTOs/CheckIn/PublicCheckInDtos.cs`). `satisfies` makes the build fail if the request type misses one;
 * the backend test `PublicCheckInSubmitContractTests` keeps the same lists, so change both together.
 */
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

/** Form values of a guest: from the guest on file, or empty. The document number is never prefilled (masked by the API). */
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

/**
 * Guests the form starts with: the ones on file (first one the booker) and, up to the guests declared on the booking,
 * empty members of the first guest's family or group.
 */
export function initialStayGuests(
  prefills: readonly PublicCheckInGuestPrefill[] | undefined,
  declaredGuests: number | undefined,
): StayGuestFormValues[] {
  const declared = Math.min(MAX_STAY_GUESTS, Math.max(1, declaredGuests ?? 1));
  const guests = (prefills ?? []).slice(0, MAX_STAY_GUESTS).map((prefill) => stayGuestDefaults(prefill.type, prefill));
  if (guests.length === 0) guests.push(stayGuestDefaults(declared > 1 ? 'HeadOfFamily' : 'SingleGuest'));
  if (!isLeaderType(guests[0].type)) guests[0].type = declared > 1 ? 'HeadOfFamily' : 'SingleGuest';
  while (guests.length < declared) guests.push(stayGuestDefaults(followerTypeOf(guests[0].type)));
  return guests;
}

/** What a request to the API carries beyond the data every entry has. */
export interface StayGuestSubmitOptions {
  /** The statistical fields the region requires: only these are sent, the others are left out of the request. */
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
}

function textOrNull(value: string): string | null {
  const text = value.trim();
  return text === '' ? null : text;
}

/** One guest of the request body, every key present. Place and document fields that do not apply are sent empty. */
export function toStayGuestSubmit(values: StayGuestFormValues, options: StayGuestSubmitOptions = {}): StayGuestSubmit {
  const bornInItaly = values.bornInItaly === 'yes';
  const withDocument = requiresDocument(values.type);
  const residenceInItaly = values.residenceInItaly === 'yes' ? true : values.residenceInItaly === 'no' ? false : null;
  const statistical = options.statisticalFields ?? [];
  // A required field is always sent (empty as null); a held one only where the host's entry sends back what it received.
  const sends = (field: StatisticalGuestField) =>
    statistical.includes(field) || (options.keepStatistical === true && textOrNull(values[field]) !== null);
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
    ...(sends('tourismType') ? { tourismType: textOrNull(values.tourismType) } : {}),
    ...(sends('travelWay') ? { travelWay: textOrNull(values.travelWay) } : {}),
    ...(sends('educationLevel') ? { educationLevel: textOrNull(values.educationLevel) } : {}),
    ...(options.withTaxExemption ? { taxExemptionCode: textOrNull(values.taxExemptionCode) } : {}),
  };
}

/** Request body sent by the guest portal for valid form values. */
export function toPublicCheckInSubmitRequest(
  values: PublicCheckInFormValues,
  options: Pick<StayGuestSubmitOptions, 'statisticalFields'> = {},
): PublicCheckInSubmitRequest {
  return {
    guests: values.guests.map((guest) => toStayGuestSubmit(guest, options)),
    marketingConsentEmail: values.marketingConsentEmail ?? false,
    marketingConsentWhatsApp: values.marketingConsentWhatsApp ?? false,
    marketingEmail: values.marketingEmail?.trim() || null,
  };
}
