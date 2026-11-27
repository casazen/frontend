/**
 * The two public pages the marketing e-mails link to (E07/F06/US03/T01). The signed values of a link travel in its **fragment**
 * (`PublicSiteLinks.MarketingUnsubscribe`, `PublicSiteLinks.MarketingConfirm`), which a browser never sends to a server; the page reads
 * them and posts them back unchanged as the query of the call. The answers are those of `PublicMarketingController`.
 */

/** Signed values of `/unsubscribe#…` (`MarketingUnsubscribeLinks.Create`): never the address, only its keyed hash. */
export interface UnsubscribeLinkParams {
  orgId: string;
  emailHash: string;
  expiresAt: string;
  signature: string;
  /** Only on the link of a campaign e-mail. */
  campaignId?: string;
}

/** Signed values of `/marketing/confirm#…` (`MarketingConfirmationLinks.Create`): the contact and the expiry, never the address or the org. */
export interface ConfirmLinkParams {
  contactId: string;
  expiresAt: string;
  signature: string;
}

/** `POST /public/marketing/unsubscribe`: the same answer on a repeat. */
export interface UnsubscribeResult {
  unsubscribed: boolean;
}

/** `POST /public/marketing/confirm`: `alreadyConfirmed` when the same link was used before. */
export interface ConfirmResult {
  confirmed: boolean;
  alreadyConfirmed: boolean;
}
