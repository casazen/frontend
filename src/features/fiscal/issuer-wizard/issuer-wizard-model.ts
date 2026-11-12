import { isAxiosError } from 'axios';
import type { FiscalTaxProfileUpdate } from '@/api/fiscal.api';
import { compactIdentifier } from '@/features/fiscal/tax-profile-changes';
import { getProblemCode } from '@/lib/api-errors';
import { readWizardDraft, type WizardDraft, type WizardDraftScope } from '@/lib/wizard-draft';
import {
  DOCUMENT_ISSUER_MODES,
  FISCAL_ISSUER_FIELDS,
  type DocumentIssuerMode,
  type DocumentRegime,
  type FiscalDocumentSettings,
  type FiscalIssuerField,
  type SaveFiscalDocumentSettingsRequest,
  type SaveFiscalIssuerDataRequest,
} from '@/types';
import {
  ISSUER_DRAFT_VERSION,
  ISSUER_STEPS,
  ISSUER_WIZARD_ID,
  regimeHasVatNumber,
  regimeOfAnswers,
  type IssuerAvailability,
  type IssuerIdentityOnRecord,
  type IssuerStepId,
  type IssuerWizardValues,
  type VatAnswer,
  type VatRegimeAnswer,
} from './issuer-wizard-schema';

/** The mode in which CasaZen issues: the one that has two more steps (the data and the address of the issuer). */
export const CASAZEN_MODE: DocumentIssuerMode = 'CasaZenDirectOnly';

function isIssuerMode(value: unknown): value is DocumentIssuerMode {
  return typeof value === 'string' && (DOCUMENT_ISSUER_MODES as readonly string[]).includes(value);
}

/** The choice the form holds, or `null` while it holds none (or something that is not one of the three). */
export function modeFromValues(values: Pick<IssuerWizardValues, 'mode'>): DocumentIssuerMode | null {
  return isIssuerMode(values.mode) ? values.mode : null;
}

/** The steps of the wizard for the choice made: the data and the address of the issuer only where CasaZen is the one that issues. */
export function stepIdsFor(mode: DocumentIssuerMode | null): IssuerStepId[] {
  return mode === CASAZEN_MODE
    ? [ISSUER_STEPS.who, ISSUER_STEPS.regime, ISSUER_STEPS.issuer, ISSUER_STEPS.address, ISSUER_STEPS.summary]
    : [ISSUER_STEPS.who, ISSUER_STEPS.regime, ISSUER_STEPS.summary];
}

/** What this environment and this organization can do today, from the setting the server sent. */
export function availabilityOf(settings: Pick<FiscalDocumentSettings, 'casazenIssuanceEnabled' | 'octorateConnected'>): IssuerAvailability {
  return { casazenIssuanceEnabled: settings.casazenIssuanceEnabled, octorateConnected: settings.octorateConnected };
}

/** What of the tax profile the organization already has: the VAT number and the fiscal code the server read from it. */
export function identityOnRecord(settings: Pick<FiscalDocumentSettings, 'issuer'>): IssuerIdentityOnRecord {
  return { vatNumber: Boolean(settings.issuer.vatNumber), fiscalCode: Boolean(settings.issuer.fiscalCode) };
}

/**
 * The channel manager is the issuer the wizard recommends only when it can issue every booking (the answer to D34) and the organization is
 * connected to it: otherwise it is one choice among the others, or not a choice at all yet.
 */
export function isChannelManagerRecommended(settings: Pick<FiscalDocumentSettings, 'octorateIssuesAllBookings' | 'octorateConnected'>): boolean {
  return settings.octorateIssuesAllBookings && settings.octorateConnected;
}

/** The two answers that lead to a regime, the other way round: what a saved regime says about them. */
function answersOfRegime(regime: DocumentRegime | undefined): { hasVatNumber: VatAnswer | null; vatRegime: VatRegimeAnswer | null } {
  switch (regime) {
    case 'PrivatePerson':
      return { hasVatNumber: 'no', vatRegime: null };
    case 'VatOrdinary':
      return { hasVatNumber: 'yes', vatRegime: 'ordinary' };
    case 'VatFlatRate':
      return { hasVatNumber: 'yes', vatRegime: 'flatRate' };
    default:
      return { hasVatNumber: null, vatRegime: null };
  }
}

/**
 * The regime code of the electronic invoice the regime usually has (RF01 ordinary, RF19 flat-rate): shown as the example of the field, never
 * sent for the person. An empty field means «the one of my regime», which the server takes from its configuration.
 */
export function proposedRegimeCode(regime: DocumentRegime | null): string {
  return regime === 'VatFlatRate' ? 'RF19' : 'RF01';
}

/**
 * What the field of the regime code becomes when the answers of the regime lead to `regime`, or `null` when it stays as it is. The code the
 * accountant chose (the override saved on the setting) belongs to the regime it was chosen for, so it must not go on the documents of another
 * one: while the answers lead anywhere else the field the person never touched is emptied (the server then takes the code of the regime), and
 * it comes back when they lead to the saved regime again. A code the person wrote is theirs and is never touched.
 */
export function regimeCodeFollowing(
  current: string,
  regime: DocumentRegime | null,
  saved: Pick<FiscalDocumentSettings, 'regime' | 'issuer'>,
): string | null {
  const override = saved.issuer.fatturaPaRegimeCode;
  if (!override) return null;
  if (regime === saved.regime) return current.trim() === '' ? override : null;
  return current.trim().toUpperCase() === override.trim().toUpperCase() ? '' : null;
}

/**
 * What the wizard starts from: the setting as the server has it, and what CasaZen knows besides (the name of the organization for the name on
 * the documents, the tax profile for the VAT number and the fiscal code). Someone who already has a VAT number on record has answered the
 * first question of the regime. The person confirms rather than types.
 */
export function issuerDefaults(settings: FiscalDocumentSettings, organizationName: string): IssuerWizardValues {
  const issuer = settings.issuer;
  const answers = answersOfRegime(settings.regime);
  return {
    mode: settings.mode ?? null,
    hasVatNumber: answers.hasVatNumber ?? (issuer.vatNumber ? 'yes' : null),
    vatRegime: answers.vatRegime,
    legalName: issuer.legalName ?? organizationName,
    vatNumber: issuer.vatNumber ?? '',
    fiscalCode: issuer.fiscalCode ?? '',
    fatturaPaRegimeCode: issuer.fatturaPaRegimeCode ?? '',
    issuerSdiRecipientCode: issuer.issuerSdiRecipientCode ?? '',
    issuerPec: issuer.issuerPec ?? '',
    defaultSeries: issuer.defaultSeries ?? '',
    addressStreet: issuer.addressStreet ?? '',
    addressCivic: issuer.addressCivic ?? '',
    postalCode: issuer.postalCode ?? '',
    city: issuer.city ?? '',
    province: issuer.province ?? '',
    countryCode: issuer.countryCode || 'IT',
  };
}

/**
 * A draft is used only if it is newer than the last confirmation of the setting: the answers of a tab left open since before somebody saved
 * would put old answers over newer ones.
 */
export function isDraftCurrent(draft: Pick<WizardDraft, 'savedAt'>, settings: Pick<FiscalDocumentSettings, 'confirmedAt'>): boolean {
  if (!settings.confirmedAt) return true;
  const confirmedAt = Date.parse(settings.confirmedAt);
  return !Number.isFinite(confirmedAt) || draft.savedAt > confirmedAt;
}

/**
 * The choice the wizard opens with, which decides the steps it opens with: the one in the draft the form is going to be given (the shell reads
 * it the same way, and refuses it by the same rule), else the one the server has. It is read before the shell is there because the list of the
 * steps depends on it.
 */
export function initialModeOf(settings: FiscalDocumentSettings, scope: WizardDraftScope | null): DocumentIssuerMode | null {
  const saved = settings.mode ?? null;
  if (!scope) return saved;
  const draft = readWizardDraft(ISSUER_WIZARD_ID, scope, { version: ISSUER_DRAFT_VERSION });
  if (!draft || !isDraftCurrent(draft, settings)) return saved;
  if (!('mode' in draft.values)) return saved;
  const drafted = draft.values.mode;
  return isIssuerMode(drafted) ? drafted : null;
}

/** A text written the way the server stores it: the ends trimmed, and nothing at all when it is blank. */
function text(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** The data of the issuer as the person wrote it, normalized as the server does (letters of the province, of the codes and of the PEC). */
function issuerFromForm(values: IssuerWizardValues): SaveFiscalIssuerDataRequest {
  const postalCode = values.postalCode.replace(/\s+/g, '');
  return {
    legalName: text(values.legalName),
    addressStreet: text(values.addressStreet),
    addressCivic: text(values.addressCivic),
    postalCode: postalCode === '' ? undefined : postalCode,
    city: text(values.city),
    province: text(values.province)?.toUpperCase(),
    countryCode: text(values.countryCode)?.toUpperCase() ?? 'IT',
    fatturaPaRegimeCode: text(values.fatturaPaRegimeCode)?.toUpperCase(),
    issuerSdiRecipientCode: text(values.issuerSdiRecipientCode)?.toUpperCase(),
    issuerPec: text(values.issuerPec)?.toLowerCase(),
    defaultSeries: text(values.defaultSeries),
  };
}

/**
 * The data of the issuer exactly as the server has it. A save replaces the setting as a whole, and the data of the issuer is asked only when
 * CasaZen issues: whoever chooses another issuer changes who issues and the regime, and leaves the data of the issuer as it was (it would be
 * cleared otherwise). An override of the regime code belongs to the regime it was given for, and goes when the regime changes.
 */
function issuerAsSaved(settings: FiscalDocumentSettings, regime: DocumentRegime | undefined): SaveFiscalIssuerDataRequest {
  const issuer = settings.issuer;
  return {
    legalName: issuer.legalName,
    addressStreet: issuer.addressStreet,
    addressCivic: issuer.addressCivic,
    postalCode: issuer.postalCode,
    city: issuer.city,
    province: issuer.province,
    countryCode: issuer.countryCode,
    fatturaPaRegimeCode: settings.regime === regime ? issuer.fatturaPaRegimeCode : undefined,
    issuerSdiRecipientCode: issuer.issuerSdiRecipientCode,
    issuerPec: issuer.issuerPec,
    defaultSeries: issuer.defaultSeries,
  };
}

/**
 * The save the last button sends: who issues, the regime the two answers lead to, the data of the issuer (the one in the form for CasaZen, the
 * one the server has otherwise) and `confirmed`, the wizard being completed. `null` while there is no choice, which the first step does not let through.
 */
export function toSaveRequest(values: IssuerWizardValues, settings: FiscalDocumentSettings): SaveFiscalDocumentSettingsRequest | null {
  const mode = modeFromValues(values);
  if (!mode) return null;
  const regime = regimeOfAnswers(values) ?? undefined;
  return {
    mode,
    regime,
    issuer: mode === CASAZEN_MODE ? issuerFromForm(values) : issuerAsSaved(settings, regime),
    confirmed: true,
  };
}

/**
 * What the wizard adds to the tax profile of the organization when CasaZen issues: the VAT number (a regime with a VAT number) or the fiscal
 * code (a private person) that the profile does not have yet and the person wrote. Never a change to what is already on record, and `null`
 * when there is nothing to add. The setting itself cannot carry them: they live on the organization.
 */
export function taxProfileAddition(values: IssuerWizardValues, settings: FiscalDocumentSettings): FiscalTaxProfileUpdate | null {
  if (modeFromValues(values) !== CASAZEN_MODE) return null;
  const regime = regimeOfAnswers(values);
  const update: FiscalTaxProfileUpdate = {};
  if (regimeHasVatNumber(regime) && !settings.issuer.vatNumber) {
    const vatNumber = compactIdentifier(values.vatNumber);
    if (vatNumber !== '') {
      update.hasPartitaIva = true;
      update.partitaIvaNumber = vatNumber;
    }
  }
  if (regime === 'PrivatePerson' && !settings.issuer.fiscalCode) {
    const fiscalCode = compactIdentifier(values.fiscalCode).toUpperCase();
    if (fiscalCode !== '') update.fiscalCode = fiscalCode;
  }
  return Object.keys(update).length > 0 ? update : null;
}

/** A field the person can fix: every field of the setting but the country, which is not asked. */
function isFixableField(name: unknown): name is FiscalIssuerField {
  return typeof name === 'string' && name !== 'countryCode' && (FISCAL_ISSUER_FIELDS as readonly string[]).includes(name);
}

/**
 * The fields a refused save names: `issuer_profile_incomplete` lists what is missing (`fields`), `issuer_field_invalid` the values that are
 * not valid (`errors`, and the first one as `field`). Names the wizard cannot put a message on are left out. Any other answer names none.
 */
export function issuesOf(error: unknown): FiscalIssuerField[] {
  if (!isAxiosError(error) || error.response?.status !== 422) return [];
  const data: unknown = error.response.data;
  if (typeof data !== 'object' || data === null) return [];
  const body = data as Record<string, unknown>;

  let names: unknown[] = [];
  switch (getProblemCode(body)) {
    case 'issuer_profile_incomplete':
      names = Array.isArray(body.fields) ? body.fields : [];
      break;
    case 'issuer_field_invalid': {
      const listed = Array.isArray(body.errors)
        ? body.errors.map((entry) => (typeof entry === 'object' && entry !== null ? (entry as { field?: unknown }).field : undefined))
        : [];
      names = listed.length > 0 ? listed : [body.field];
      break;
    }
    default:
      return [];
  }

  return [...new Set(names.filter(isFixableField))];
}

/**
 * The field of the form a problem of the setting is shown on. The regime is answered with two questions: the problem is shown on the first
 * one. Where there is no such field the problem is only listed (the summary says it).
 */
export function formFieldOfIssue(field: FiscalIssuerField): keyof IssuerWizardValues | null {
  if (field === 'regime') return 'hasVatNumber';
  if (field === 'countryCode') return null;
  return field;
}

/** The problem of the setting a field of the form belongs to: editing the field settles it. */
export function issueOfFormField(name: string): FiscalIssuerField | null {
  if (name === 'hasVatNumber' || name === 'vatRegime') return 'regime';
  return isFixableField(name) ? name : null;
}
