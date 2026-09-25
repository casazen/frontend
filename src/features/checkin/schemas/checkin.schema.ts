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

/** Limits of the Alloggiati record (surname 50, name 30, document number 20) and of CasaZen (guests, labels). */
export const MAX_STAY_GUESTS = 30;
export const MAX_FIRST_NAME_LENGTH = 30;
export const MAX_LAST_NAME_LENGTH = 50;
export const MAX_DOCUMENT_NUMBER_LENGTH = 20;
export const MAX_LABEL_LENGTH = 100;

const PROVINCE_PATTERN = /^[A-Za-z]{2}$/;
const DOCUMENT_NUMBER_PATTERN = /^[A-Za-z0-9]+$/;

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
 * One guest of the form. Select values are plain strings (empty = not chosen) so that every conditional check below
 * runs in the same pass as the required fields.
 */
export const stayGuestFormSchema = z
  .object({
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
    documentType: z.string(),
    documentTypeCode: z.string().nullable(),
    /** Label of the chosen official document type (form only, not sent). */
    documentTypeLabel: z.string(),
    documentNumber: z.string(),
    /** Masked number already on file (`*****567`), shown as a hint (form only, not sent). */
    documentNumberOnFile: z.string().nullable(),
    documentIssuePlaceName: z.string().max(MAX_LABEL_LENGTH, 'checkin.validation.label.maxLength'),
    documentIssuePlaceCode: z.string().nullable(),
  })
  .superRefine((guest, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

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
  });

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
export const stayGuestListSchema = z
  .array(stayGuestFormSchema)
  .min(1, 'checkin.validation.guests.count')
  .max(MAX_STAY_GUESTS, 'checkin.validation.guests.count')
  .superRefine((guests, ctx) => {
    for (const { index, message } of compositionIssues(guests.map((g) => g.type))) {
      ctx.addIssue({ code: 'custom', path: [index, 'type'], message });
    }
  });

/** Host form of the guests of a stay (`PUT /alloggiati/{bookingId}/stay-guests`). */
export const stayGuestsFormSchema = z.object({ guests: stayGuestListSchema });

export type StayGuestsFormValues = z.input<typeof stayGuestsFormSchema>;

/** Server fields shown on another input of the form: a code on the input of its name. */
const SERVER_FIELD_ALIASES: Record<string, keyof StayGuestFormValues> = {
  birthComuneCode: 'birthComuneName',
  birthCountryCode: 'birthCountryName',
  citizenshipCode: 'citizenshipName',
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
  return field in stayGuestFormSchema.shape
    ? `guests.${index}.${field as keyof StayGuestFormValues}`
    : null;
}

export const publicCheckInFormSchema = z.object({
  guests: stayGuestListSchema,
  gdprConsent: z.boolean().refine((val) => val === true, {
    message: 'checkin.validation.consentAccepted.required',
  }),
  marketingConsent: z.boolean().optional(),
});

export type PublicCheckInFormValues = z.input<typeof publicCheckInFormSchema>;

/**
 * `[Required]` properties of the API DTOs `PublicCheckInSubmitRequest` and `StayGuestSubmitDto`
 * (`Casazen.Web/DTOs/CheckIn/PublicCheckInDtos.cs`). `satisfies` makes the build fail if the request type misses one;
 * the backend test `PublicCheckInSubmitContractTests` keeps the same lists, so change both together.
 */
export const PUBLIC_CHECKIN_REQUIRED_FIELDS = ['gdprConsent', 'guests'] as const satisfies readonly (keyof PublicCheckInSubmitRequest)[];

export const STAY_GUEST_REQUIRED_FIELDS = [
  'bornInItaly',
  'citizenshipName',
  'dateOfBirth',
  'firstName',
  'gender',
  'lastName',
  'type',
] as const satisfies readonly (keyof StayGuestSubmit)[];

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
    documentType: (DOCUMENT_KINDS as readonly string[]).includes(documentType) ? documentType : '',
    documentTypeCode: prefill?.documentTypeCode ?? null,
    documentTypeLabel: prefill?.documentTypeCode ?? '',
    documentNumber: '',
    documentNumberOnFile: prefill?.documentNumberMasked ?? null,
    documentIssuePlaceName: prefill?.documentIssuePlaceName ?? '',
    documentIssuePlaceCode: prefill?.documentIssuePlaceCode ?? null,
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

/** One guest of the request body, every key present. Place and document fields that do not apply are sent empty. */
export function toStayGuestSubmit(values: StayGuestFormValues): StayGuestSubmit {
  const bornInItaly = values.bornInItaly === 'yes';
  const withDocument = requiresDocument(values.type);
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
  };
}

/** Request body sent by the guest portal for valid form values. */
export function toPublicCheckInSubmitRequest(values: PublicCheckInFormValues): PublicCheckInSubmitRequest {
  return {
    guests: values.guests.map(toStayGuestSubmit),
    gdprConsent: values.gdprConsent,
    marketingConsent: values.marketingConsent ?? false,
  };
}

export const guestCheckInFormSchema = z.object({
  dateOfBirth: z.string().min(1, 'checkin.validation.dateOfBirth.required'),
  placeOfBirth: z.string().min(1, 'checkin.validation.placeOfBirth.required').max(100),
  nationality: z.string().min(1, 'checkin.validation.nationality.required').max(100),
  gender: z.enum(['Male', 'Female', 'Other'], { message: 'checkin.validation.gender.required' }),
  documentType: z.enum(['Passport', 'IdentityCard', 'DriversLicense', 'Other'], {
    message: 'checkin.validation.documentType.required',
  }),
  documentNumber: z.string().min(1, 'checkin.validation.documentNumber.required').max(50),
  documentExpiryDate: z.string().optional(),
  documentIssuingCountry: z.string().min(1, 'checkin.validation.documentIssuingCountry.required').max(100),
  address: z.string().max(500).optional(),
  city: z.string().max(50).optional(),
  postalCode: z.string().max(10).optional(),
  country: z.string().max(100).optional(),
  consentAccepted: z.boolean().refine((val) => val === true, {
    message: 'checkin.validation.consentAccepted.required',
  }),
});

export type GuestCheckInFormValues = z.infer<typeof guestCheckInFormSchema>;
