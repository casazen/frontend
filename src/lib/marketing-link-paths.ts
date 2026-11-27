/**
 * The pages the marketing e-mails link to (CRM-08, NF-95 and CRM-03, NF-90): the unsubscribe link of every campaign and the link of the
 * double opt-in confirmation. The backend builds them (`PublicSiteLinks`), so these addresses are fixed by the e-mails already sent.
 * The welcome page behind the QR code a host prints for a house (CRM-03) is a page of the same kind: a guest's, public, and its address
 * is fixed by the codes already printed.
 */
export const UNSUBSCRIBE_PATH = '/unsubscribe';
export const MARKETING_CONFIRM_PATH = '/marketing/confirm';
/** The welcome page of a property (`PublicSiteLinks.Welcome`: `/benvenuto/{token}`): the random token of the link is the only proof. */
export const WELCOME_PATH = '/benvenuto/:token';
const WELCOME_PATH_PREFIX = '/benvenuto/';

/**
 * True on the address of one of those pages. They are for a person who only wants to stop or confirm the e-mails, or who scanned the code
 * in the house and may leave a contact, so they are public and never ask for an account (Auth0 is not loaded there), and the visit takes
 * no part in any statistic (no landing touch for the signup attribution).
 */
export function isMarketingLinkPath(pathname: string): boolean {
  return pathname.startsWith(UNSUBSCRIBE_PATH) || pathname.startsWith(MARKETING_CONFIRM_PATH) || pathname.startsWith(WELCOME_PATH_PREFIX);
}
