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
  /** The name of the comune: it follows the choice and is what the API calls the city. */
  city: string;
  address: string;
  postalCode: string;
  /** Interno / scala; '' = none. */
  unit: string;
  cadastralSheet: string;
  cadastralParcel: string;
  cadastralSubaltern: string;
  cadastralCategory: string;
  /** Text as typed ("750,50"): the number is worked out when it is sent. */
  cadastralIncome: string;
  /** The pages of the APE chosen, in the browser's memory only: never kept in the draft. */
  ape: DocumentSelection;
}

/** The flow's name: the draft is kept under it. */
export const LONG_RENT_PROPERTY_WIZARD_ID = 'long-rent-property-new';

/** The pages of a document are files: they cannot be kept in a draft (and a draft without them would look half empty). */
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

/** The biggest file the APE can be (the document API of the property takes 10 MB, as the upload window of the sheet does). */
export const APE_MAX_BYTES = 10 * 1024 * 1024;

type StepSchema = ZodType<unknown, FieldValues>;

/** An amount as it is typed in Italy: digits with an optional decimal part after a comma or a point ("750", "750,50"). */
const INCOME_PATTERN = /^\d+([.,]\d{1,2})?$/;

/** The rendita as a number, or `null` when nothing was typed or it is not an amount. */
export function parseIncome(text: string): number | null {
  const trimmed = text.trim();
  if (!INCOME_PATTERN.test(trimmed)) return null;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/**
 * The rules of the steps that have any, checked before the next one opens (the messages are i18n keys, as in every form). The place
 * has the rules of the quick form of the first property, which the API cannot do without; the cadastral data are all optional, only
 * an amount that is not an amount is refused; the APE is optional, but photos have to be confirmed as they are put in order.
 */
export const LONG_RENT_PROPERTY_STEP_SCHEMAS: { address: StepSchema; cadastral: StepSchema; ape: StepSchema } = {
  address: z.object({
    name: z.string().trim().min(3, 'property.validation.name.minLength').max(100, 'property.validation.name.maxLength'),
    // The comune is the one thing a property cannot do without afterwards: regional rules and the contract follow it.
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

/** The body of the creation: only what the API cannot do without; the rest is "not set yet", as in the quick form of the first property. */
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
    // A long-term property has no guests and no nightly rate until its owner lists it for short stays.
    maxGuests: 0,
    nightlyRate: 0,
  };
}

/** The cadastral data to send, or `null` when none was typed (there is nothing to save). */
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

/** The contract needs the sheet, the parcel, the category and the income (the subaltern is not always there): the same rule as the sheet of the property. */
export function isCadastralComplete(values: LongRentPropertyWizardValues): boolean {
  return (
    values.cadastralSheet.trim() !== '' &&
    values.cadastralParcel.trim() !== '' &&
    values.cadastralCategory.trim() !== '' &&
    parseIncome(values.cadastralIncome) !== null
  );
}

/** Whether the person chose an APE to upload. */
export const hasApeSelection = (values: Pick<LongRentPropertyWizardValues, 'ape'>): boolean => values.ape.pages.length > 0;

/** What the last button did, to tell it on the confirmation screen: the property exists whatever happened after it. */
export interface LongRentPropertyWizardResult {
  property: Property;
  /** `none`: nothing was typed. `failed`: typed, but the server did not save it (the sheet of the property has the fields). */
  cadastral: 'none' | 'saved' | 'failed';
  /** What was saved has everything the contract prints (see {@link isCadastralComplete}). */
  cadastralComplete: boolean;
  ape:
    | { status: 'none' }
    | { status: 'uploaded'; document: PropertyDocumentDto }
    /** `reason`: already in words (the document window says why a file is refused); empty = no reason known. */
    | { status: 'failed'; reason: string };
}

/** The APE has its code and class: the contract can state them. */
export function isApeIdentified(document: Pick<PropertyDocumentDto, 'apeCode' | 'apeEnergyClass'>): boolean {
  return !!document.apeCode && !!document.apeEnergyClass;
}

/** Everything the contract needs from the property is there: then the confirmation leads to the contract. */
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
