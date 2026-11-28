import { isAxiosError } from 'axios';
import axios from '@/lib/axios';
import { getProblemCode, UnexpectedApiResponseError } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type { AccountantPackageEmailQueued, AccountantPackageLastSend, AccountantPackageSettings, AgencySummary, SaveAccountantPackageSettingsRequest } from '@/types';
import { acceptsRefusal } from './accept-refusal';
import type { DownloadedFile } from './file.api';
import { ReportAccessDeniedError } from './report-files';
import { headerOf } from '@/api/response-helpers';

const PATH = '/accountant-package';
const SETTINGS_PATH = `${PATH}/settings`;
const SEND_PATH = `${PATH}/send`;

const TOO_LARGE_CODE = 'accountant_package_too_large';

const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

const SEND_TIMEOUT_MS = DOWNLOAD_TIMEOUT_MS;

const NOT_A_FILE = /^(text\/html|application\/(json|problem\+json))/i;

export function accountantPackageFileName(period: string): string {
  return `casazen-commercialista-${period}.zip`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The summary the server answered, or a load error: a body that is not the summary (the page of another kind an odd proxy sends, a server older than this page) is never drawn, because a
 * missing list would show up as «nothing this month» and a missing block would crash the page. Only the shape the screen walks is checked; the figures are the server's.
 */
function asAgencySummary(data: unknown): AgencySummary {
  const summary = isRecord(data) ? data : null;
  const lists = ['guestDocuments', 'portalCosts', 'commissions', 'payouts', 'wires', 'portalCommissionsBorne', 'margin', 'owners'] as const;
  const blocks = ['stays', 'collections', 'touristTax', 'ownerInvoices'] as const;
  if (
    !summary ||
    typeof summary.period !== 'string' ||
    typeof summary.periodKind !== 'string' ||
    typeof summary.from !== 'string' ||
    typeof summary.to !== 'string' ||
    typeof summary.generatedOn !== 'string' ||
    typeof summary.ownerAccountingIncluded !== 'boolean' ||
    lists.some((key) => !Array.isArray(summary[key])) ||
    blocks.some((key) => !isRecord(summary[key]))
  ) {
    throw new UnexpectedApiResponseError(`${PATH}/agency-summary`);
  }
  const { collections, touristTax, ownerInvoices } = summary as { collections: Record<string, unknown>; touristTax: Record<string, unknown>; ownerInvoices: Record<string, unknown> };
  if (
    !Array.isArray(collections.toCollect) ||
    !Array.isArray(touristTax.switzerland) ||
    !isRecord(touristTax.italy) ||
    !Array.isArray(ownerInvoices.counts) ||
    !Array.isArray(ownerInvoices.rates)
  ) {
    throw new UnexpectedApiResponseError(`${PATH}/agency-summary`);
  }
  return data as AgencySummary;
}

function asLastSend(value: unknown): AccountantPackageLastSend | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value) || typeof value.period !== 'string' || typeof value.at !== 'string' || (value.result !== 'sent' && value.result !== 'failed')) {
    throw new UnexpectedApiResponseError(SETTINGS_PATH);
  }
  return { period: value.period, at: value.at, result: value.result, error: typeof value.error === 'string' && value.error !== '' ? value.error : null };
}

/**
 * The settings of the send as the server answered, or a load error: a body that is not the settings (the page of another kind an odd proxy sends, a server older than this page) is never
 * drawn, because a missing day or list of folders would be shown as a choice nobody made. The server leaves out what is empty (an address that is not there, no last send): that is `null`.
 */
function asSettings(data: unknown): AccountantPackageSettings {
  const body = isRecord(data) ? data : null;
  if (
    !body ||
    typeof body.enabled !== 'boolean' ||
    typeof body.sendDay !== 'number' ||
    !Number.isInteger(body.sendDay) ||
    !Array.isArray(body.contents) ||
    body.contents.some((key) => typeof key !== 'string') ||
    (body.email !== null && body.email !== undefined && typeof body.email !== 'string')
  ) {
    throw new UnexpectedApiResponseError(SETTINGS_PATH);
  }
  return {
    enabled: body.enabled,
    email: typeof body.email === 'string' && body.email.trim() !== '' ? body.email : null,
    sendDay: body.sendDay,
    contents: body.contents as string[],
    lastSend: asLastSend(body.lastSend),
    updatedAt: typeof body.updatedAt === 'string' ? body.updatedAt : null,
  };
}

function asEmailQueued(data: unknown): AccountantPackageEmailQueued {
  if (!isRecord(data) || typeof data.period !== 'string' || data.queued !== true || typeof data.linkExpiresAt !== 'string') {
    throw new UnexpectedApiResponseError(SEND_PATH);
  }
  return { period: data.period, queued: true, linkExpiresAt: data.linkExpiresAt };
}

export function accountantPackageTooLarge(error: unknown): { fileCount: number | null; maxFiles: number | null } | null {
  if (!isAxiosError(error) || error.response?.status !== 422 || getProblemCode(error.response.data) !== TOO_LARGE_CODE) return null;
  const body = error.response.data as Record<string, unknown>;
  const wholeNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : null);
  const fileCount = wholeNumber(body.fileCount);
  const maxFiles = wholeNumber(body.maxFiles);
  return fileCount === null || maxFiles === null ? { fileCount: null, maxFiles: null } : { fileCount, maxFiles };
}

/**
 * The package of the accountant, the summary of the agency and how the package is sent to the accountant (E15/F02/US01/T01 and US02/T01, NF-101, NF-115; backend `api/accountant-package`).
 * Paths are relative to the API base URL, which already ends in `/api`. Every call needs `payment.read` and answers 404 while the flag `AccountantPackage` is off; the owner accounting is
 * part of the answer only for a caller who may read it, which the server decides. The package and the summary are built on request and never stored; what is written here is the setting
 * of the send (the address of the accountant, whether it goes every month, its day and its folders) and, with the test send, the month that the monthly e-mail then does not repeat.
 */
export const accountantPackageApi = {
  getAgencySummary: async (period: string): Promise<AgencySummary | null> => {
    const response = await axios.get<unknown>(`${PATH}/agency-summary`, { params: { period }, validateStatus: acceptsRefusal });
    if (response.status === 403) return null;
    return asAgencySummary(response.data);
  },

  /**
   * The ZIP of a month or a year, through the authenticated client (never from an address the browser would open without the token), with the name the server gave it (`Content-Disposition`,
   * `null` when the page cannot read it). The call can be stopped (`signal`) and tells how many bytes came so far (`onProgress`: the server does not know the size beforehand); the server
   * refuses a package that is too large before the first byte (422, see {@link accountantPackageTooLarge}) and a 403 is a `ReportAccessDeniedError`, an answer of the call and not a trip to
   * the page of no access. A problem body (a JSON Blob) is parsed so that its code can be read.
   */
  download: async (period: string, options: { signal?: AbortSignal; onProgress?: (bytes: number) => void } = {}): Promise<DownloadedFile> => {
    try {
      const response = await axios.get<Blob>(PATH, {
        params: { period },
        responseType: 'blob',
        timeout: DOWNLOAD_TIMEOUT_MS,
        signal: options.signal,
        onDownloadProgress: (event) => options.onProgress?.(event.loaded),
        validateStatus: acceptsRefusal,
      });
      if (response.status === 403) throw new ReportAccessDeniedError(PATH);
      if (!(response.data instanceof Blob) || NOT_A_FILE.test(response.data.type)) throw new UnexpectedApiResponseError(PATH);
      return { blob: response.data, contentDisposition: headerOf(response.headers, 'content-disposition') };
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /**
   * How the package is sent to the accountant (`GET api/accountant-package/settings`): the address, the monthly send, its day and its folders, and the last attempt; the defaults of the
   * server for an organization that saved none. The settings are the organization's, never a part of it: a caller restricted to some of the properties is refused (403), and that is `null`
   * here, because a refused read would send the whole app to the page of no access and the step only has to say that the access is not there.
   */
  getSettings: async (): Promise<AccountantPackageSettings | null> => {
    const response = await axios.get<unknown>(SETTINGS_PATH, { validateStatus: acceptsRefusal });
    if (response.status === 403) return null;
    return asSettings(response.data);
  },

  updateSettings: async (body: SaveAccountantPackageSettingsRequest): Promise<AccountantPackageSettings> => asSettings((await axios.put<unknown>(SETTINGS_PATH, body)).data),

  /**
   * «Send a test» (`POST api/accountant-package/send`): the package of the previous month, with the folders of the settings, is made and the e-mail with its link is put in the queue for the
   * address SAVED in the settings, never one that comes with the request. It counts as the send of that month, so the monthly run does not send it again. 422
   * `accountant_package_recipient_missing`, `accountant_package_too_large`, `accountant_package_owner_accounting_required` and `accountant_package_not_sent` (nothing went out); 429 when the person
   * asks too often. «Queued» is all the server says: never that the e-mail was delivered.
   */
  sendTest: async (): Promise<AccountantPackageEmailQueued> => asEmailQueued((await axios.post<unknown>(SEND_PATH, undefined, { timeout: SEND_TIMEOUT_MS })).data),
};
