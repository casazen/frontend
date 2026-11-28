import { isAxiosError } from 'axios';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';

export class SiteConnectionError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  /** What the person can read about it, when the answer has words for it (a wait for too many requests, a connection that is down, a code the app knows); the screen has its own sentence otherwise. */
  readonly userMessage: string | undefined;

  constructor(status: number | undefined, code: string | undefined, userMessage: string | undefined) {
    super(code ?? 'site_connection_failed');
    this.name = 'SiteConnectionError';
    this.status = status;
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function reduceSiteConnectionError(error: unknown): SiteConnectionError {
  if (error instanceof SiteConnectionError) return error;
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  return new SiteConnectionError(getHttpStatus(error), code, getProblemMessage(error, i18n.t));
}
