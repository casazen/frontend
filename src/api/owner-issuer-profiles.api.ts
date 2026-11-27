import axios from '@/lib/axios';
import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type { OwnerIssuerProfile, OwnerIssuerProfileRequest } from '@/types';
import { acceptsRefusal } from './accept-refusal';
import type { DownloadedFile } from './file.api';
import { ReportAccessDeniedError } from './report-files';

const profilePath = (ownerId: string) => `/owners/${encodeURIComponent(ownerId)}/issuer-profile`;
const exportPath = (ownerId: string) => `/owners/${encodeURIComponent(ownerId)}/issued-documents/export`;

/** The ZIP is streamed while the server builds it (the PDF and the XML of every document of the period): it may take minutes, not the 30 s of every other call. */
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

/** A file answer that says it is a web page or a JSON body is not the ZIP that was asked for (the `index.html` of a wrong rewrite). */
const NOT_A_FILE = /^(text\/html|application\/(json|problem\+json))/i;

/** The name the server gives the ZIP of a period (`casazen-documenti-emessi-2026-10.zip`): the page falls back to it when the header that carries it cannot be read. */
export function issuedDocumentsFileName(period: string): string {
  return `casazen-documenti-emessi-${period}.zip`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A member the API leaves out when it is empty: a text, or `null` for what is missing or empty. */
const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** The value of a header of an answer, whatever the case of its name, or `null` (a browser lets a page read only the headers that the API exposes). */
function headerOf(headers: unknown, name: string): string | null {
  if (!isRecord(headers)) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === 'string') return value;
  }
  return null;
}

/** The VAT of the stay in the rule in force, in percent: the rate of the line type `Accommodation`, when the answer carries the rule. */
function stayRateOf(rule: unknown): number | null {
  if (!isRecord(rule) || !Array.isArray(rule.rates)) return null;
  const rate = rule.rates.find((candidate) => isRecord(candidate) && candidate.lineType === 'Accommodation');
  return isRecord(rate) && typeof rate.percent === 'number' && Number.isFinite(rate.percent) ? rate.percent : null;
}

/**
 * The profile the screens can draw without guessing: the flags and the codes are there and are of the right type. A body that is not a profile (the `index.html` of a wrong rewrite) is a load error,
 * never an empty form: a form that starts empty over a profile that exists would be saved as a blank one.
 */
function profileOf(data: unknown, url: string): OwnerIssuerProfile {
  if (
    !isRecord(data) ||
    typeof data.ownerId !== 'string' ||
    typeof data.exists !== 'boolean' ||
    typeof data.canIssue !== 'boolean' ||
    typeof data.masked !== 'boolean' ||
    typeof data.countryCode !== 'string' ||
    typeof data.stayVatTreatment !== 'string' ||
    typeof data.defaultGuestDocumentSeries !== 'string' ||
    !Array.isArray(data.missingFields)
  ) {
    throw new UnexpectedApiResponseError(url);
  }
  return {
    ownerId: data.ownerId,
    exists: data.exists,
    canIssue: data.canIssue,
    masked: data.masked,
    regime: textOf(data.regime),
    legalName: textOf(data.legalName),
    fiscalCode: textOf(data.fiscalCode),
    vatNumber: textOf(data.vatNumber),
    addressStreet: textOf(data.addressStreet),
    addressCivic: textOf(data.addressCivic),
    postalCode: textOf(data.postalCode),
    city: textOf(data.city),
    province: textOf(data.province),
    countryCode: data.countryCode,
    fatturaPaRegimeCode: textOf(data.fatturaPaRegimeCode),
    effectiveRegimeCode: textOf(data.effectiveRegimeCode),
    stayVatTreatment: data.stayVatTreatment,
    guestDocumentSeries: textOf(data.guestDocumentSeries),
    defaultGuestDocumentSeries: data.defaultGuestDocumentSeries,
    stampDutyReference: textOf(data.stampDutyReference),
    issuerSdiRecipientCode: textOf(data.issuerSdiRecipientCode),
    issuerPec: textOf(data.issuerPec),
    missingFields: data.missingFields.filter((field): field is string => typeof field === 'string'),
    stayRatePercent: stayRateOf(data.rule),
  };
}

/**
 * The issuer profile of an owner (`GET api/owners/{ownerId}/issuer-profile`, `agency.owner.view`), or the empty one of an owner that has none (`exists: false`). The personal data come in clear only for a caller
 * who may change the profile (`masked: false`); any other caller gets them masked. `null` when the server refuses it to the caller (403): a refused read would send the whole app to the page of no access,
 * and the screen only has to say that the profile is not for this person. 404 `owner_not_found` for an owner of another organization or out of the reach of the caller.
 */
export async function getOwnerIssuerProfile(ownerId: string): Promise<OwnerIssuerProfile | null> {
  const url = profilePath(ownerId);
  const response = await axios.get<unknown>(url, { validateStatus: acceptsRefusal });
  if (response.status === 403) return null;
  return profileOf(response.data, url);
}

/**
 * Saves the profile as a whole (`PUT`, `agency.owner.financial.manage` and the whole organization): what the request leaves out is cleared, and an incomplete profile is saved and says what is missing
 * (`missingFields`); nothing is issued on it until it is complete. 403 `fiscal_settings_need_whole_org`, 404 `owner_not_found`, 422 `issuer_field_invalid` (with the `field` and the `errors`),
 * `issuer_regime_country_mismatch`, `document_issuance_not_available`; a refusal saves nothing.
 */
export async function saveOwnerIssuerProfile(ownerId: string, request: OwnerIssuerProfileRequest): Promise<OwnerIssuerProfile> {
  const url = profilePath(ownerId);
  const response = await axios.put<unknown>(url, request);
  return profileOf(response.data, url);
}

/**
 * The ZIP for the accountant of an owner (`GET api/owners/{ownerId}/issued-documents/export?period=2026-10`, or `?period=2026`), through the authenticated client: the PDF and the XML of the documents CasaZen
 * issued in the name of the owner in the period, their register and the index with the SHA-256 of every file. `agency.statement.view` and the whole organization (a 403 is a `ReportAccessDeniedError`,
 * an answer of the call and not a trip to the page of no access). A problem body (a JSON Blob) is parsed so that its code can be read: 400 `accountant_package_invalid_period`, 404 `owner_not_found`,
 * 422 `accountant_package_too_large` before the first byte.
 */
export async function exportOwnerIssuedDocuments(ownerId: string, period: string, options: { signal?: AbortSignal } = {}): Promise<DownloadedFile> {
  const url = exportPath(ownerId);
  try {
    const response = await axios.get<Blob>(url, { params: { period }, responseType: 'blob', timeout: DOWNLOAD_TIMEOUT_MS, signal: options.signal, validateStatus: acceptsRefusal });
    if (response.status === 403) throw new ReportAccessDeniedError(url);
    if (!(response.data instanceof Blob) || NOT_A_FILE.test(response.data.type)) throw new UnexpectedApiResponseError(url);
    return { blob: response.data, contentDisposition: headerOf(response.headers, 'content-disposition') };
  } catch (error) {
    throw await withJsonErrorBody(error);
  }
}
