import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { EMPTY_DOCUMENT, documentReady, type DocumentSelection } from '@/lib/document-pdf';
import type { CreatePropertyDto, Property, PropertyCadastralData, PropertyDocumentDto } from '@/types';

/**
 * What the landlord answers in the wizard "Aggiungi immobile" of Affitti lunghi (LR-07c). The wizard (`WizardShell`) holds them as
 * the values of its form and keeps them as a draft in the session; nothing here is a personal data (an address and the cadastral
 * identification of a unit are not), so the draft is allowed. The step is not one of them: it lives in the address (`?step=`).
 *
 * Only fields the model has: the name, the place, the cadastral identification and the APE (the contract states them). Type, size
 * and indicative rent are not in the model (LR-D30) and are not asked.
 */
export interface LongRentPropertyWizardValues {
  name: string;
  /** ISTAT code of the comune chosen from the official list; '' = none chosen yet. */
  comuneIstatCode: string;
  city: string;
  address: string;
  postalCode: string;
  unit: string;
  cadastralSheet: string;
  cadastralParcel: string;
  cadastralSubaltern: string;
  cadastralCategory: string;
  cadastralIncome: string;
  ape: DocumentSelection;
}

export const LONG_RENT_PROPERTY_WIZARD_ID = 'long-rent-property-new';

export const LONG_RENT_PROPERTY_WIZARD_DRAFT_EXCLUDE: readonly string[] = ['ape'];

export const LONG_RENT_PROPERTY_WIZARD_DEFAULTS: LongRentPropertyWizardValues = {
  name: '',
  comuneIstatCode: '',
  city: '',
  address: '',
  postalCode: '',
  unit: '',
  cadastralSheet: '',
  cadastralParcel: '',
  cadastralSubaltern: '',
  cadastralCategory: '',
  cadastralIncome: '',
  ape: EMPTY_DOCUMENT,
};

export const APE_MAX_BYTES = 10 * 1024 * 1024;

type StepSchema = ZodType<unknown, FieldValues>;

const INCOME_PATTERN = /^\d+([.,]\d{1,2})?$/;

export function parseIncome(text: string): number | null {
  const trimmed = text.trim();
  if (!INCOME_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

export const LONG_RENT_PROPERTY_STEP_SCHEMAS: { address: StepSchema; cadastral: StepSchema; ape: StepSchema } = {
  address: z.object({
    name: z.string().trim().min(3, 'property.validation.name.minLength').max(100, 'property.validation.name.maxLength'),
    comuneIstatCode: z.string().regex(/^[0-9]{6}$/, 'property.quick.validation.comuneRequired'),
    city: z.string().min(2, 'property.validation.city.required'),
    address: z.string().trim().min(5, 'property.validation.address.required'),
    postalCode: z.string().trim().min(3, 'property.validation.postalCode.required'),
    unit: z.string().max(30, 'property.validation.unit.maxLength'),
  }),
  cadastral: z.object({
    cadastralIncome: z
      .string()
      .refine((text) => text.trim() === '' || parseIncome(text) !== null, 'longRentProperties.wizard.validation.income'),
  }),
  ape: z.object({
    ape: z.custom<DocumentSelection>().refine((selection) => selection.pages.length === 0 || documentReady(selection), {
      message: 'longRentProperties.wizard.validation.apeNotConfirmed',
    }),
  }),
};

export function toCreatePayload(values: LongRentPropertyWizardValues): CreatePropertyDto {
  return {
    name: values.name.trim(),
    address: values.address.trim(),
    unit: values.unit.trim() ? values.unit.trim() : null,
    city: values.city,
    comuneIstatCode: values.comuneIstatCode,
    postalCode: values.postalCode.trim(),
    description: '',
    bedrooms: 1,
    bathrooms: 1,
    maxGuests: 0,
    nightlyRate: 0,
  };
}

export function toCadastralPayload(values: LongRentPropertyWizardValues): PropertyCadastralData | null {
  const data: PropertyCadastralData = {
    sheet: values.cadastralSheet.trim() || null,
    parcel: values.cadastralParcel.trim() || null,
    subaltern: values.cadastralSubaltern.trim() || null,
    category: values.cadastralCategory.trim() || null,
    income: parseIncome(values.cadastralIncome),
  };
  return Object.values(data).every((field) => field === null) ? null : data;
}

export function isCadastralComplete(values: LongRentPropertyWizardValues): boolean {
  return (
    values.cadastralSheet.trim() !== '' &&
    values.cadastralParcel.trim() !== '' &&
    values.cadastralCategory.trim() !== '' &&
    parseIncome(values.cadastralIncome) !== null
  );
}

export const hasApeSelection = (values: Pick<LongRentPropertyWizardValues, 'ape'>): boolean => values.ape.pages.length > 0;

export interface LongRentPropertyWizardResult {
  property: Property;
  cadastral: 'none' | 'saved' | 'failed';
  cadastralComplete: boolean;
  ape:
    | { status: 'none' }
    | { status: 'uploaded'; document: PropertyDocumentDto }
    | { status: 'failed'; reason: string };
}

export function isApeIdentified(document: Pick<PropertyDocumentDto, 'apeCode' | 'apeEnergyClass'>): boolean {
  return !!document.apeCode && !!document.apeEnergyClass;
}

export function isReadyForContract(result: LongRentPropertyWizardResult, liveApe?: PropertyDocumentDto): boolean {
  const apeDocument = liveApe ?? (result.ape.status === 'uploaded' ? result.ape.document : null);
  return (
    result.cadastral === 'saved' &&
    result.cadastralComplete &&
    apeDocument !== null &&
    isApeIdentified(apeDocument) &&
    apeDocument.apeCheck !== 'Expired'
  );
}
