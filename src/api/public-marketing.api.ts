import { ApiClient } from './client';
import type {
  ConfirmLinkParams,
  ConfirmResult,
  UnsubscribeLinkParams,
  UnsubscribeResult,
} from '@/types/public-marketing.types';

/** The signed values as the query of the call, one pair for each value the link carried (a value that is not there is not sent). */
function signedQuery(params: object): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string') query.append(name, value);
  }
  return query.toString();
}

/**
 * The calls of the pages the marketing e-mails link to (E07/F06/US03/T01, CRM-08 and CRM-03). Anonymous: the signature of the link is the
 * only key, so no access token is sent. The values go back exactly as the link carried them, in the query as the backend reads them
 * (`PublicMarketingController`); the link's own fragment never reached a server.
 */
export const publicMarketingApi = {
  /**
   * Stops the promotional e-mails of the org to the address behind the link. Idempotent: a repeat answers the same. 400 `signature_missing`
   * (or another missing value) and 422 `invalid_timestamp`, `link_expired`, `invalid_signature` say the link does not work; 429 when asked too often.
   */
  unsubscribe: (params: UnsubscribeLinkParams) =>
    ApiClient.post<UnsubscribeResult>(`/public/marketing/unsubscribe?${signedQuery(params)}`, undefined, { public: true }),

  /**
   * Confirms the subscription of the contact behind the link; `alreadyConfirmed` when it was. The same codes as above for a link that
   * does not work, and 404 `contact_not_found` when the signature is good but the contact is gone.
   */
  confirm: (params: ConfirmLinkParams) =>
    ApiClient.post<ConfirmResult>(`/public/marketing/confirm?${signedQuery(params)}`, undefined, { public: true }),
};
