import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import type { OwnerFiscalProfile, OwnerAddress, OwnerIssuerProfile, OwnerIssuerProfileRequest, OwnerIssuerRegime, PropertyOwnerSummary } from '@/types';
import { OWNER_ISSUER_REGIMES } from '@/types';

export interface OwnerIssuerForm {
  regime: OwnerIssuerRegime | '';
  legalName: string;
  fiscalCode: string;
  vatNumber: string;
  fatturaPaRegimeCode: string;
  addressStreet: string;
  addressCivic: string;
  postalCode: string;
  city: string;
  province: string;
  stayVatTreatment: 'Standard' | 'ExemptArt10';
  guestDocumentSeries: string;
  stampDutyReference: string;
  issuerSdiRecipientCode: string;
  issuerPec: string;
}

export type OwnerIssuerField = keyof OwnerIssuerForm;

const FIELDS: readonly OwnerIssuerField[] = [
  'regime',
  'legalName',
  'fiscalCode',
  'vatNumber',
  'fatturaPaRegimeCode',
  'addressStreet',
  'addressCivic',
  'postalCode',
  'city',
  'province',
  'stayVatTreatment',
  'guestDocumentSeries',
  'stampDutyReference',
  'issuerSdiRecipientCode',
  'issuerPec',
];

const isRegime = (value: string | null): value is OwnerIssuerRegime => value !== null && (OWNER_ISSUER_REGIMES as readonly string[]).includes(value);

export function isOwnerIssuerField(name: string): name is OwnerIssuerField {
  return (FIELDS as readonly string[]).includes(name);
}

export function formOf(profile: OwnerIssuerProfile): OwnerIssuerForm {
  return {
    regime: isRegime(profile.regime) ? profile.regime : '',
    legalName: profile.legalName ?? '',
    fiscalCode: profile.fiscalCode ?? '',
    vatNumber: profile.vatNumber ?? '',
    fatturaPaRegimeCode: profile.fatturaPaRegimeCode ?? '',
    addressStreet: profile.addressStreet ?? '',
    addressCivic: profile.addressCivic ?? '',
    postalCode: profile.postalCode ?? '',
    city: profile.city ?? '',
    province: profile.province ?? '',
    stayVatTreatment: profile.stayVatTreatment === 'ExemptArt10' ? 'ExemptArt10' : 'Standard',
    guestDocumentSeries: profile.guestDocumentSeries ?? '',
    stampDutyReference: profile.stampDutyReference ?? '',
    issuerSdiRecipientCode: profile.issuerSdiRecipientCode ?? '',
    issuerPec: profile.issuerPec ?? '',
  };
}

export function isChanged(form: OwnerIssuerForm, saved: OwnerIssuerForm): boolean {
  return FIELDS.some((field) => form[field].trim() !== saved[field].trim());
}

function keepField<K extends OwnerIssuerField>(target: OwnerIssuerForm, source: OwnerIssuerForm, field: K): void {
  target[field] = source[field];
}

export function followedForm(form: OwnerIssuerForm, base: OwnerIssuerForm, stored: OwnerIssuerForm): OwnerIssuerForm {
  const followed: OwnerIssuerForm = { ...stored };
  for (const field of FIELDS) {
    if (form[field].trim() !== base[field].trim()) keepField(followed, form, field);
  }
  return followed;
}

const text = (value: string): string | undefined => (value.trim() === '' ? undefined : value.trim());

export function requestOf(form: OwnerIssuerForm): OwnerIssuerProfileRequest {
  return {
    regime: form.regime === '' ? undefined : form.regime,
    legalName: text(form.legalName),
    fiscalCode: text(form.fiscalCode)?.toUpperCase(),
    vatNumber: text(form.vatNumber),
    fatturaPaRegimeCode: text(form.fatturaPaRegimeCode)?.toUpperCase(),
    addressStreet: text(form.addressStreet),
    addressCivic: text(form.addressCivic),
    postalCode: text(form.postalCode),
    city: text(form.city),
    province: text(form.province)?.toUpperCase(),
    countryCode: 'IT',
    stayVatTreatment: form.stayVatTreatment,
    guestDocumentSeries: text(form.guestDocumentSeries),
    stampDutyReference: text(form.stampDutyReference),
    issuerSdiRecipientCode: text(form.issuerSdiRecipientCode)?.toUpperCase(),
    issuerPec: text(form.issuerPec),
  };
}

export function isItalianProfile(profile: Pick<OwnerIssuerProfile, 'countryCode'>): boolean {
  return profile.countryCode.trim().toUpperCase() === 'IT';
}

/** Whether the owner is a company or a professional with a VAT number: an invoice (FatturaPA) is made out in its name, otherwise a receipt. */
export function issuesInvoices(regime: OwnerIssuerRegime | ''): boolean {
  return regime === 'VatOrdinary' || regime === 'VatFlatRate';
}

export function refusedFieldsOf(error: unknown): OwnerIssuerField[] {
  if (!isAxiosError(error) || error.response?.status !== 422) return [];
  const data: unknown = error.response.data;
  if (typeof data !== 'object' || data === null || getProblemCode(data) !== 'issuer_field_invalid') return [];
  const body = data as Record<string, unknown>;
  const listed = Array.isArray(body.errors) ? body.errors.map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { field?: unknown }).field : undefined)) : [];
  const names = listed.length > 0 ? listed : [body.field];
  return [...new Set(names.filter((name): name is string => typeof name === 'string' && isOwnerIssuerField(name)))] as OwnerIssuerField[];
}

export function missingFieldsOf(profile: Pick<OwnerIssuerProfile, 'missingFields'>): OwnerIssuerField[] {
  return profile.missingFields.filter(isOwnerIssuerField);
}

export type OwnerIssuerState = 'none' | 'incomplete' | 'ready';

export function issuerStateOf(profile: Pick<OwnerIssuerProfile, 'exists' | 'canIssue'>): OwnerIssuerState {
  if (!profile.exists) return 'none';
  return profile.canIssue ? 'ready' : 'incomplete';
}

/**
 * The profile of an owner made from what CasaZen already knows of it (the quick creation of the step «Proprietari che emettono»): the name, the fiscal code and the VAT number of the profile in force
 * of the owner accounting, the billing address, and the regime that follows from them (a company or a person with a VAT number: ordinary regime, an invoice; a person without one: a private person, a
 * receipt). The treatment of the stay is the standard one (⚖ I1): nothing is decided for the owner that the data does not say. Whatever is still missing, the server says it when it saves, and the
 * person completes it; nothing is invented to fill a field.
 */
export function issuerRequestFromOwnerData(data: { owner: PropertyOwnerSummary | null; profile: OwnerFiscalProfile | null; address: OwnerAddress | null }): OwnerIssuerProfileRequest {
  const { owner, profile, address } = data;
  const fullName = owner ? `${owner.firstName} ${owner.lastName}`.trim() : '';
  const legalName = text(profile?.legalName ?? '') ?? text(fullName);
  const vatNumber = text(profile?.vatNumber ?? '');
  const company = profile?.entityKind === 'LegalEntity';
  // A VAT number says an invoice; a person with no VAT number and a profile is a private person (a receipt); a company with no VAT number says nothing yet, and the person answers.
  let regime: OwnerIssuerRegime | undefined;
  if (vatNumber !== undefined) regime = 'VatOrdinary';
  else if (!company && profile) regime = 'PrivatePerson';
  return {
    regime,
    legalName,
    fiscalCode: text(profile?.fiscalCode ?? '')?.toUpperCase(),
    vatNumber,
    addressStreet: text(address?.street ?? ''),
    addressCivic: text(address?.buildingNumber ?? ''),
    postalCode: text(address?.postalCode ?? ''),
    city: text(address?.town ?? ''),
    province: text(address?.province ?? '')?.toUpperCase(),
    countryCode: 'IT',
    stayVatTreatment: 'Standard',
  };
}
