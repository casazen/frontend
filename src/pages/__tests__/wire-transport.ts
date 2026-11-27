import { AxiosError } from 'axios';
import type { AxiosAdapter, AxiosResponse } from 'axios';

/** What the server answers to a request: the status and the body. */
export interface WireReply {
  status: number;
  data?: unknown;
}

/** A request of the wire page as the server receives it: the method, the path, the currency of a list of payable payouts (the only parameter of a read) and the body of a write, parsed. */
export interface WireRequest {
  method: string;
  path: string;
  currency: string | undefined;
  body: unknown;
}

/** The body of a request as the adapter gets it: the JSON text the client wrote, parsed again. */
function bodyOf(data: unknown): unknown {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

/**
 * The transport under the REAL client of the app (its interceptors, its handlers of the 403 and the wire API stay as they are: only the network is replaced). It judges the
 * status as the real ones do (`settle`): by the `validateStatus` of the request, a rejection otherwise, so a read that takes the 403 as an answer gets it, and any other 4xx or
 * 5xx is an error. `onRequest` hears every request as one line: the method, the path and, for a list of payable payouts, its currency.
 */
export function wireTransport(answer: (request: WireRequest) => WireReply, onRequest: (line: string) => void = () => undefined): AxiosAdapter {
  return async (config) => {
    const method = (config.method ?? 'get').toUpperCase();
    const path = config.url ?? '';
    const currency = (config.params as { currency?: string } | undefined)?.currency;
    onRequest(`${method} ${path}${currency ? `?currency=${currency}` : ''}`);
    const { status, data } = answer({ method, path, currency, body: bodyOf(config.data) });
    const response: AxiosResponse = { status, data, statusText: '', headers: {}, config, request: {} };
    if (config.validateStatus ? config.validateStatus(status) : status >= 200 && status < 300) return response;
    throw new AxiosError(`Request failed with status code ${status}`, status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST, config, {}, response);
  };
}
