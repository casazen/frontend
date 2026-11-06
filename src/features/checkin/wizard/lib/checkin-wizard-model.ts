import { z } from 'zod';
import {
  MAX_STAY_GUESTS,
  createStayGuestListSchema,
  followerTypeOf,
  isLeaderType,
  normalizeDocumentNumber,
  requiredStatisticalFields,
  stayGuestDefaults,
  toStayGuestSubmit,
  type StatisticalGuestField,
  type StayGuestFormValues,
} from '@/features/checkin/schemas/checkin.schema';
import type {
  CheckInConfirmation,
  CheckInIssue,
  CheckInWizardGuest,
  CheckInWizardState,
  DocumentReadingFields,
  GuestExemption,
  OctorateCheckInSendState,
  StayTouristTax,
} from '@/types/checkin-wizard.types';
import type { StayGuestSubmit } from '@/types/public-checkin.types';

/** The steps of the host wizard, in order. The result ("What happens now") is the confirmation screen of the shell, not a step. */
export const CHECKIN_WIZARD_STEPS = ['guests', 'documents', 'checks', 'tax', 'send'] as const;
export type CheckInWizardStepId = (typeof CHECKIN_WIZARD_STEPS)[number];

/** What the form of the wizard holds: the guests, with the new fields and the tourist tax exemption they came with. */
export interface CheckInWizardValues {
  guests: StayGuestFormValues[];
}

/**
 * The address a "Fix" or the end of a failed save points at: the step and, when there is one, the id of the field to focus
 * (`?step=documents&focus=guest-0-documentNumber`).
 */
export const FOCUS_PARAM = 'focus';

/** The form values of a guest the server has, as the host edits them. The document number is masked by the API: the host types it again. */
export function guestValuesFromWizard(guest: CheckInWizardGuest): StayGuestFormValues {
  const bornInItaly = guest.bornInItaly;
  const documentType = guest.documentType ?? '';
  return {
    ...stayGuestDefaults(guest.type),
    firstName: guest.firstName,
    lastName: guest.lastName,
    gender: guest.gender === 'Male' || guest.gender === 'Female' ? guest.gender : '',
    dateOfBirth: guest.dateOfBirth?.slice(0, 10) ?? '',
    bornInItaly: bornInItaly === true ? 'yes' : bornInItaly === false ? 'no' : '',
    birthComuneName: guest.birthComuneName,
    birthComuneCode: guest.birthComuneCode ?? null,
    birthProvince: guest.birthProvince ?? '',
    birthCountryName: guest.birthCountryName,
    birthCountryCode: guest.birthCountryCode ?? null,
    citizenshipName: guest.citizenshipName,
    citizenshipCode: guest.citizenshipCode ?? null,
    residenceInItaly: guest.residenceInItaly === true ? 'yes' : guest.residenceInItaly === false ? 'no' : '',
    residenceComuneName: guest.residenceComuneName ?? '',
    residenceComuneCode: guest.residenceComuneCode ?? null,
    residenceProvince: guest.residenceProvince ?? '',
    residenceCountryName: guest.residenceCountryName ?? '',
    residenceCountryCode: guest.residenceCountryCode ?? null,
    tourismType: guest.tourismType ?? '',
    travelWay: guest.travelWay ?? '',
    educationLevel: guest.educationLevel ?? '',
    documentType: ['Passport', 'IdentityCard', 'DriversLicense'].includes(documentType) ? documentType : '',
    documentTypeCode: guest.documentTypeCode ?? null,
    documentTypeLabel: guest.documentTypeCode ?? '',
    documentNumber: '',
    documentNumberOnFile: guest.documentNumberMasked ?? null,
    documentIssuePlaceName: guest.documentIssuePlaceName,
    documentIssuePlaceCode: guest.documentIssuePlaceCode ?? null,
    documentIssuedOn: guest.documentIssuedOn?.slice(0, 10) ?? '',
    documentExpiresOn: guest.documentExpiresOn?.slice(0, 10) ?? '',
    taxExemptionCode: guest.taxExemptionCode ?? '',
  };
}

/**
 * The guests the form starts with: the ones of the state in record order (the booker alone, unsaved, when none is registered) and, up to
 * the guests the booking declares, empty members of the first guest's family or group.
 */
export function wizardValuesFromState(state: CheckInWizardState): CheckInWizardValues {
  const declared = Math.min(MAX_STAY_GUESTS, Math.max(1, state.booking.declaredGuests));
  const guests = state.guests.slice(0, MAX_STAY_GUESTS).map(guestValuesFromWizard);
  if (guests.length === 0) guests.push(stayGuestDefaults(declared > 1 ? 'HeadOfFamily' : 'SingleGuest'));
  if (!isLeaderType(guests[0].type)) guests[0].type = declared > 1 ? 'HeadOfFamily' : 'SingleGuest';
  while (guests.length < declared) guests.push(stayGuestDefaults(followerTypeOf(guests[0].type)));
  return { guests };
}

/** The statistical fields the region of the property requires (the `requiredGuestFields` of the state). */
export function statisticalFieldsOf(state: CheckInWizardState): StatisticalGuestField[] {
  return requiredStatisticalFields(state.requiredGuestFields);
}

/** The step the wizard opens on: the one the server suggests; "nothing left to do" opens the last step, where the host can confirm again. */
export function initialStepOf(state: CheckInWizardState): CheckInWizardStepId {
  const suggested = state.suggestedStep;
  if (suggested === 'result') return 'send';
  return (CHECKIN_WIZARD_STEPS as readonly string[]).includes(suggested) ? (suggested as CheckInWizardStepId) : 'guests';
}

/** The request body of `PUT …/checkin-wizard/guests`: every guest, the exemption of the tourist tax as the host received it. */
export function toGuestsPayload(values: CheckInWizardValues, statisticalFields: readonly StatisticalGuestField[]): StayGuestSubmit[] {
  return values.guests.map((guest) => toStayGuestSubmit(guest, { statisticalFields, withTaxExemption: true }));
}

/**
 * What a save would send, as a text, to tell whether the host changed anything since the last save. The tourist tax exemption is left out:
 * it is saved by its own endpoint on the tax step, and travels with the guests only so that a save does not erase it.
 */
export function guestsSignature(values: CheckInWizardValues, statisticalFields: readonly StatisticalGuestField[]): string {
  return JSON.stringify(values.guests.map((guest) => toStayGuestSubmit(guest, { statisticalFields })));
}

/** The rules of the guests step: the personal data of each guest, the order of the guests, the statistical fields the region requires. */
export function guestsStepSchema(statisticalFields: readonly StatisticalGuestField[]) {
  return z.object({ guests: createStayGuestListSchema(statisticalFields, 'personal') });
}

/** The rules of the document of every guest who needs one, as the server wants them to save. */
const documentsSchema = createStayGuestListSchema([], 'document');

/** True when every guest who needs a document has it complete (the number typed, not only on file): the server saves no guest without it. */
export function documentsReadyToSave(values: CheckInWizardValues): boolean {
  return documentsSchema.safeParse(values.guests).success;
}

/**
 * The rules of the documents step. When the host changed nothing (`isUnchanged`) there is nothing to save, so a document that is only on
 * file (its number masked) is not asked again; as soon as something changed, the list is saved as a whole and the numbers have to be typed.
 */
export function documentsStepSchema(isUnchanged: (values: CheckInWizardValues) => boolean) {
  return z
    .object({ guests: z.array(z.any()) })
    .superRefine((values, ctx) => {
      if (isUnchanged(values as CheckInWizardValues)) return;
      const result = documentsSchema.safeParse(values.guests);
      if (result.success) return;
      for (const issue of result.error.issues) ctx.addIssue({ code: 'custom', path: ['guests', ...issue.path], message: issue.message });
    });
}

/** The step a field of a guest belongs to, and the id the field has on that step (`guest-<position>-<field>`). */
interface IssueFieldTarget {
  step: 'guests' | 'documents';
  /** The field of the form (`StayGuestFormValues`). */
  field: keyof StayGuestFormValues;
}

const ISSUE_FIELD_TARGETS: Readonly<Record<string, IssueFieldTarget>> = {
  type: { step: 'guests', field: 'type' },
  lastName: { step: 'guests', field: 'lastName' },
  firstName: { step: 'guests', field: 'firstName' },
  gender: { step: 'guests', field: 'gender' },
  dateOfBirth: { step: 'guests', field: 'dateOfBirth' },
  bornInItaly: { step: 'guests', field: 'bornInItaly' },
  birthComune: { step: 'guests', field: 'birthComuneName' },
  birthProvince: { step: 'guests', field: 'birthProvince' },
  birthCountry: { step: 'guests', field: 'birthCountryName' },
  citizenship: { step: 'guests', field: 'citizenshipName' },
  residence: { step: 'guests', field: 'residenceInItaly' },
  residenceComune: { step: 'guests', field: 'residenceComuneName' },
  residenceCountry: { step: 'guests', field: 'residenceCountryName' },
  tourismType: { step: 'guests', field: 'tourismType' },
  travelWay: { step: 'guests', field: 'travelWay' },
  educationLevel: { step: 'guests', field: 'educationLevel' },
  documentType: { step: 'documents', field: 'documentType' },
  documentNumber: { step: 'documents', field: 'documentNumber' },
  documentIssuePlace: { step: 'documents', field: 'documentIssuePlaceName' },
  documentExpiresOn: { step: 'documents', field: 'documentExpiresOn' },
};

const DOCUMENT_FORM_FIELDS: ReadonlySet<keyof StayGuestFormValues> = new Set([
  'documentType',
  'documentTypeCode',
  'documentTypeLabel',
  'documentNumber',
  'documentNumberOnFile',
  'documentIssuePlaceName',
  'documentIssuePlaceCode',
  'documentIssuedOn',
  'documentExpiresOn',
]);

/** The step that shows a field of the guests form: the document fields are on the documents step, the others on the guests step. */
export function stepOfGuestField(field: keyof StayGuestFormValues): 'guests' | 'documents' {
  return DOCUMENT_FORM_FIELDS.has(field) ? 'documents' : 'guests';
}

/** Where a "Fix" of the checks leads: the step of the field and the field to focus (none for an issue of the stay as a whole). */
export interface IssueTarget {
  step: 'guests' | 'documents';
  fieldId: string | null;
}

export function issueTarget(issue: Pick<CheckInIssue, 'position' | 'field'>): IssueTarget {
  const target = issue.field ? ISSUE_FIELD_TARGETS[issue.field] : undefined;
  if (!target) return { step: 'guests', fieldId: null };
  return { step: target.step, fieldId: issue.position === null ? null : `guest-${issue.position}-${target.field}` };
}

/** The id of an issue field's label (`checkin.wizard.field.<field>`), written out for the i18n test. */
export const ISSUE_FIELD_LABEL_KEYS: Readonly<Record<string, string>> = {
  guests: 'checkin.wizard.field.guests',
  type: 'checkin.wizard.field.type',
  lastName: 'checkin.wizard.field.lastName',
  firstName: 'checkin.wizard.field.firstName',
  gender: 'checkin.wizard.field.gender',
  dateOfBirth: 'checkin.wizard.field.dateOfBirth',
  bornInItaly: 'checkin.wizard.field.bornInItaly',
  birthComune: 'checkin.wizard.field.birthComune',
  birthProvince: 'checkin.wizard.field.birthProvince',
  birthCountry: 'checkin.wizard.field.birthCountry',
  citizenship: 'checkin.wizard.field.citizenship',
  residence: 'checkin.wizard.field.residence',
  residenceComune: 'checkin.wizard.field.residenceComune',
  residenceCountry: 'checkin.wizard.field.residenceCountry',
  tourismType: 'checkin.wizard.field.tourismType',
  travelWay: 'checkin.wizard.field.travelWay',
  educationLevel: 'checkin.wizard.field.educationLevel',
  documentType: 'checkin.wizard.field.documentType',
  documentNumber: 'checkin.wizard.field.documentNumber',
  documentIssuePlace: 'checkin.wizard.field.documentIssuePlace',
  documentExpiresOn: 'checkin.wizard.field.documentExpiresOn',
};

/** The plain-words sentence of each issue code (`checkin.wizard.checks.issue.<code>`), written out for the i18n test. */
export const ISSUE_TEXT_KEYS: Readonly<Record<string, string>> = {
  guest_field_missing: 'checkin.wizard.checks.issue.guest_field_missing',
  guest_code_missing: 'checkin.wizard.checks.issue.guest_code_missing',
  octorate_field_missing: 'checkin.wizard.checks.issue.octorate_field_missing',
  guest_field_required: 'checkin.wizard.checks.issue.guest_field_required',
  document_expired: 'checkin.wizard.checks.issue.document_expired',
  guests_count_mismatch: 'checkin.wizard.checks.issue.guests_count_mismatch',
};

/** The issues in the order the checks step shows them: the blocking ones first, then the warnings, each group in the order of the server. */
export function sortedIssues(issues: readonly CheckInIssue[]): CheckInIssue[] {
  return [...issues.filter((issue) => issue.blocking), ...issues.filter((issue) => !issue.blocking)];
}

/** What a failed save (or confirmation) points at: the 422 `checkin_not_ready` of the confirmation. */
export const CHECKIN_NOT_READY_CODE = 'checkin_not_ready';

/**
 * The exemption the host just chose for one guest, for `PUT …/tourist-tax/exemptions` (a null code clears it). Only that position goes: the
 * API changes the positions it is given and leaves the others as they are, so an exemption the host cannot see (its reason is shown only to
 * who holds `guest.read`: it can reveal a health condition, art. 9 GDPR) is never sent back as null and never erased.
 */
export function exemptionOf(position: number, code: string): GuestExemption[] {
  return [{ position, code: code || null }];
}

/** The text of the line "guests in Octorate" of the result, from what the confirmation did. */
export type OctorateResultKind = 'sent' | 'nothingToSend' | 'senderNotChannelManager' | 'notConnected' | 'notActive' | 'failed' | 'partlyFailed';

export function octorateResultKind(octorate: CheckInConfirmation['octorate']): OctorateResultKind {
  const state: OctorateCheckInSendState = octorate.state;
  switch (state) {
    case 'Sent':
      return 'sent';
    case 'NothingToSend':
      return 'nothingToSend';
    case 'Failed':
      return 'failed';
    case 'PartlyFailed':
      return 'partlyFailed';
    case 'NotApplicable':
      return octorate.reason === 'sender_not_channel_manager' ? 'senderNotChannelManager' : 'notActive';
    default:
      return 'notConnected';
  }
}

/** Guests that Octorate refused or could not take now (the confirmation lists each one's outcome). */
export function failedGuestPositions(octorate: CheckInConfirmation['octorate']): number[] {
  return octorate.guests.filter((guest) => guest.outcome === 'Failed').map((guest) => guest.position);
}

/** How the tourist tax stands for the person at the send step and the result: to collect, collected by the channel, not known. */
export type TaxOutlook = 'toCollect' | 'collectedByChannel' | 'missingRate' | 'collectorNeeded' | 'notCalculable' | 'none';

export function taxOutlook(tax: StayTouristTax | null | undefined): TaxOutlook {
  if (!tax) return 'none';
  if (tax.missingRate) return 'missingRate';
  if (tax.status !== 'Calculated' || tax.total === null) return 'notCalculable';
  if (tax.collectorNeeded) return 'collectorNeeded';
  if (tax.collector === 'Channel') return 'collectedByChannel';
  return 'toCollect';
}

/**
 * The breakdown of the stay (ADR-037-R6): nights, guests, exempt guests, the night limit when it applied, and the total. The API sends
 * the tax guest by guest, so the figures are read from the lines: a guest who pays but has fewer taxable nights than nights has met a
 * limit (the cap of nights or the season of the rate).
 */
export interface TaxBreakdown {
  nights: number;
  guests: number;
  exemptGuests: number;
  payingGuests: number;
  /** The most taxable nights of a paying guest. */
  taxableNights: number;
  /** A paying guest has fewer taxable nights than the stay has nights: a night cap or a season limits the tax. */
  capApplied: boolean;
  /** What a paying guest pays for one night, when every paying guest pays the same (null otherwise, or when nobody pays). */
  perPersonPerNight: number | null;
  total: number | null;
}

export function taxBreakdownOf(tax: StayTouristTax): TaxBreakdown {
  const paying = tax.guests.filter((guest) => guest.exemptionKind === 'None');
  const taxableNights = paying.reduce((most, guest) => Math.max(most, guest.taxableNights), 0);
  const rates = paying
    .filter((guest) => guest.taxableNights > 0 && guest.amount !== null)
    .map((guest) => Math.round(((guest.amount as number) / guest.taxableNights) * 100) / 100);
  const uniform = rates.length > 0 && rates.every((rate) => rate === rates[0]);
  return {
    nights: tax.nights,
    guests: tax.guests.length,
    exemptGuests: tax.guests.length - paying.length,
    payingGuests: paying.length,
    taxableNights,
    capApplied: paying.some((guest) => guest.taxableNights < guest.nights),
    perPersonPerNight: uniform ? rates[0] : null,
    total: tax.total,
  };
}

/**
 * The first day a municipality rate the host declares applies. The API reads "no day" as today, and a rate is in force only from its first
 * day, so a stay that began before today (the wizard also opens for arrived and departed stays) would stay without a rate, and saving
 * again a rate already declared would take it away from every earlier night. So: the day the rate already had, else today, but never later
 * than the check-in of the stay the host is looking at. Days are `YYYY-MM-DD`.
 */
export function rateEffectiveFrom(declaredFrom: string | null | undefined, checkIn: string, today: string): string {
  const first = (declaredFrom ?? today).slice(0, 10);
  const arrival = checkIn.slice(0, 10);
  return arrival < first ? arrival : first;
}

/** The fields of a guest that the reading of a document photo can fill. */
export type ReadableGuestField = 'firstName' | 'lastName' | 'gender' | 'dateOfBirth' | 'documentType' | 'documentNumber' | 'documentExpiresOn';

/** The order the fields of a reading are offered in. */
export const READABLE_GUEST_FIELDS: readonly ReadableGuestField[] = [
  'lastName',
  'firstName',
  'gender',
  'dateOfBirth',
  'documentType',
  'documentNumber',
  'documentExpiresOn',
];

function dayOf(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? '';
}

function documentKindOf(code: string | null | undefined): string {
  const first = code?.trim().charAt(0).toUpperCase();
  if (first === 'P') return 'Passport';
  if (first === 'I' || first === 'C') return 'IdentityCard';
  return '';
}

/**
 * What a reading says about the guest, as values of the form: only the fields it found (never an empty one). The number is as the record
 * wants it, the sex is the one of Alloggiati Web, dates are calendar days. The nationality and the issuing state are codes, not the names
 * the form asks for, so they are left to the host.
 */
export function formValuesFromReading(fields: DocumentReadingFields | null | undefined): Partial<Record<ReadableGuestField, string>> {
  if (!fields) return {};
  const sex = fields.sex?.trim().toUpperCase();
  const values: Partial<Record<ReadableGuestField, string>> = {
    lastName: fields.surname?.trim() ?? '',
    firstName: fields.givenNames?.trim() ?? '',
    gender: sex === 'M' ? 'Male' : sex === 'F' ? 'Female' : '',
    dateOfBirth: dayOf(fields.dateOfBirth),
    documentType: documentKindOf(fields.documentType),
    documentNumber: fields.documentNumber ? normalizeDocumentNumber(fields.documentNumber) : '',
    documentExpiresOn: dayOf(fields.expirationDate),
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== '')) as Partial<Record<ReadableGuestField, string>>;
}

/** The reading of a field against what the host already typed: nothing to ask when empty or equal; a conflict when they differ. */
export interface ReadingMerge {
  /** Fields that were empty and now hold what the photo shows. */
  filled: ReadableGuestField[];
  /** Fields the host had filled in differently: kept as typed until the host asks for the photo's value. */
  conflicts: Array<{ field: ReadableGuestField; typed: string; read: string }>;
}

export function mergeReading(
  current: Pick<StayGuestFormValues, ReadableGuestField>,
  read: Partial<Record<ReadableGuestField, string>>,
): ReadingMerge {
  const merge: ReadingMerge = { filled: [], conflicts: [] };
  for (const field of READABLE_GUEST_FIELDS) {
    const value = read[field];
    if (value === undefined) continue;
    const typed = current[field];
    if (typed.trim() === '') merge.filled.push(field);
    else if (typed.trim().toLowerCase() !== value.trim().toLowerCase()) merge.conflicts.push({ field, typed, read: value });
  }
  return merge;
}
