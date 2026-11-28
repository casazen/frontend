export const UNSUBSCRIBE_PATH = '/unsubscribe';
export const MARKETING_CONFIRM_PATH = '/marketing/confirm';
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
