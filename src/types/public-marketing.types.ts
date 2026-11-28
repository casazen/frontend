/**
 * The two public pages the marketing e-mails link to (E07/F06/US03/T01). The signed values of a link travel in its **fragment**
 * (`PublicSiteLinks.MarketingUnsubscribe`, `PublicSiteLinks.MarketingConfirm`), which a browser never sends to a server; the page reads
 * them and posts them back unchanged as the query of the call. The answers are those of `PublicMarketingController`.
 */

export interface UnsubscribeLinkParams {
  orgId: string;
  emailHash: string;
  expiresAt: string;
  signature: string;
  campaignId?: string;
}

export interface ConfirmLinkParams {
  contactId: string;
  expiresAt: string;
  signature: string;
}

export interface UnsubscribeResult {
  unsubscribed: boolean;
}

export interface ConfirmResult {
  confirmed: boolean;
  alreadyConfirmed: boolean;
}
