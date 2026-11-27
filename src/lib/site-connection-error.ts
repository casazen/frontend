import { isAxiosError } from 'axios';
import i18n from '@/i18n/config';
import { getHttpStatus, getProblemCode, getProblemMessage } from '@/lib/api-errors';

/**
 * What is left of a failed call about the connected sites (PLG-FE-CONSOLE, NF-201, NF-203), and all that a screen needs of it: the HTTP status (the page that asks to connect a site tells
 * «richiesta non valida» for a 400 and «solo un amministratore» for a 401 or a 403), the stable `code` of the error and the message the person can read, in their language. Not the
 * error of the HTTP client: it holds the whole request (the state and the challenge, the access token of the person in its headers), and a failed mutation keeps its error in the cache
 * of the mutations for as long as the page that made it is open.
 */
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

/** The error of a call reduced to its status, its code and its message. */
export function reduceSiteConnectionError(error: unknown): SiteConnectionError {
  if (error instanceof SiteConnectionError) return error;
  const code = isAxiosError(error) ? getProblemCode(error.response?.data) : undefined;
  return new SiteConnectionError(getHttpStatus(error), code, getProblemMessage(error, i18n.t));
}
