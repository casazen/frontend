import { AxiosError, isAxiosError } from 'axios';

type TranslateFn = (key: string) => string;

/**
 * Thrown by the API client instead of sending a protected request without a bearer token
 * (no auth provider mounted, Auth0 `login_required`, empty token…). `reason` carries the
 * Auth0 error code when there is one.
 */
export class AuthTokenUnavailableError extends Error {
  readonly reason: string;

  constructor(reason: string, options?: { cause?: unknown }) {
    super(`Access token unavailable (${reason})`, options);
    this.name = 'AuthTokenUnavailableError';
    this.reason = reason;
  }
}

/**
 * Thrown when a request succeeded but its body is not the JSON shape the endpoint returns, e.g. the
 * SPA `index.html` served for `/api/*` by a misconfigured rewrite or dev server. Callers treat it as
 * a load error instead of rendering (and crashing on) an unexpected value.
 */
export class UnexpectedApiResponseError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`Unexpected response body from ${url}`);
    this.name = 'UnexpectedApiResponseError';
    this.url = url;
  }
}

const MAX_MESSAGE_LENGTH = 500;
const MAX_VALIDATION_MESSAGES = 3;
const CODE_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;
/** ProblemDetails `type` links of the RFCs: their `title` is only the generic HTTP reason phrase. */
const RFC_TYPE_PATTERN = /tools\.ietf\.org|rfc-editor\.org|datatracker\.ietf\.org/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH || text.startsWith('<')) return undefined;
  return text;
}

/**
 * Free-text server message worth showing: at least two words. Single tokens are error codes
 * (`too_many_guests`), bare reason phrases or unresolved resource keys (`ForbiddenDetail`).
 */
function sentenceText(value: unknown): string | undefined {
  const text = cleanText(value);
  return text && /\s/.test(text) ? text : undefined;
}

function validationMessages(errors: unknown): string | undefined {
  const collected: string[] = [];
  const add = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(add);
      return;
    }
    const text = cleanText(value) ?? (isRecord(value) ? cleanText(value.message ?? value.errorMessage) : undefined);
    if (text && !collected.includes(text)) collected.push(text);
  };

  if (Array.isArray(errors)) add(errors);
  else if (isRecord(errors)) Object.values(errors).forEach(add);

  return collected.length > 0 ? collected.slice(0, MAX_VALIDATION_MESSAGES).join('\n') : undefined;
}

function toCamelCase(code: string): string {
  const [first = '', ...rest] = code.toLowerCase().split('_').filter(Boolean);
  return first + rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
}

function translateCode(code: string, t: TranslateFn): string | undefined {
  const key = `apiErrors.codes.${toCamelCase(code)}`;
  const translated = t(key);
  return translated && translated !== key ? translated : undefined;
}

/**
 * Translation of a stable backend error `code` stored in a resource (e.g. the `lastErrorCode` of an iCal feed),
 * or `undefined` when the frontend has no text for it (`apiErrors.codes.<camelCase code>`).
 */
export function translateErrorCode(code: string | null | undefined, t: TranslateFn): string | undefined {
  return code && CODE_PATTERN.test(code) ? translateCode(code, t) : undefined;
}

/** HTTP status of a failed API call, or undefined when no response was received. */
export function getHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

/**
 * 403 `code` sent by the backend for every request of a deactivated account (PL-03). It takes precedence over any
 * other 403: the app opens the "account disabled" page instead of showing the error.
 */
export const ACCOUNT_INACTIVE_CODE = 'account_inactive';

/** True for the 403 `account_inactive` of a deactivated account (see {@link ACCOUNT_INACTIVE_CODE}). */
export function isAccountInactiveError(error: unknown): boolean {
  return (
    isAxiosError(error) &&
    error.response?.status === 403 &&
    getProblemCode(error.response.data) === ACCOUNT_INACTIVE_CODE
  );
}

/** Stable machine-readable `code` of an error body (ProblemDetails extension or legacy `{ code }`). */
export function getProblemCode(data: unknown): string | undefined {
  if (!isRecord(data)) return undefined;
  const code = data.code;
  return typeof code === 'string' && CODE_PATTERN.test(code) ? code : undefined;
}

/**
 * Failures worth retrying: no response received (network error, timeout) or a 5xx other than
 * 501 Not Implemented. Never 4xx, cancellations or missing tokens.
 */
export function isTransientRequestError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status !== undefined) return status >= 500 && status !== 501;
  return (
    error.code === AxiosError.ERR_NETWORK ||
    error.code === AxiosError.ECONNABORTED ||
    error.code === AxiosError.ETIMEDOUT
  );
}

function readServerMessage(data: unknown): string | undefined {
  if (typeof data === 'string') return sentenceText(data);
  if (!isRecord(data)) return undefined;

  const title = typeof data.type === 'string' && RFC_TYPE_PATTERN.test(data.type) ? undefined : data.title;

  return (
    sentenceText(data.detail) ??
    validationMessages(data.errors) ??
    sentenceText(data.error) ??
    sentenceText(data.message) ??
    sentenceText(title)
  );
}

/**
 * User-facing message for a failed API call, or `undefined` when the error carries nothing more
 * useful than the caller's own generic message:
 *
 * ```ts
 * toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('toast.bookingCreateFailed'));
 * ```
 *
 * Reads, in order: a translated `code` (`apiErrors.codes.<camelCase code>`), the session/permission
 * status (401, 403, 429), then for other 4xx the RFC 7807 ProblemDetails `detail`, validation
 * `errors`, the legacy `{ error }` / `{ message }` bodies and a non-generic `title`.
 * Free text of 5xx responses is ignored: it is never actionable and may expose internals.
 */
export function getProblemMessage(error: unknown, t: TranslateFn): string | undefined {
  if (error instanceof AuthTokenUnavailableError) return t('apiErrors.sessionExpired');
  if (!isAxiosError(error) || error.code === AxiosError.ERR_CANCELED) return undefined;

  const response = error.response;
  if (!response) return isTransientRequestError(error) ? t('apiErrors.network') : undefined;

  const code = getProblemCode(response.data);
  const codeMessage = code ? translateCode(code, t) : undefined;
  if (codeMessage) return codeMessage;

  const { status } = response;
  const authenticated = error.config?.public !== true;
  if (status === 401 && authenticated) return t('apiErrors.sessionExpired');
  if (status === 403 && authenticated) return t('apiErrors.forbidden');
  if (status === 429) return t('apiErrors.tooManyRequests');
  if (status >= 500) return undefined;

  return readServerMessage(response.data);
}
