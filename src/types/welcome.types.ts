/**
 * The welcome link of a property as the host sees it (`GET|POST /api/properties/{propertyId}/welcome-link`, `POST …/rotate`; E07/F04/US01/T03,
 * NF-90): whether the property has an active link, the address behind the QR code to print and when the link was made. A property that has
 * none answers `active: false` and nothing else.
 */
export interface WelcomeLink {
  active: boolean;
  /** The address of the welcome page (`/benvenuto/{token}`); null without a link, or while the public address of the web app is not configured. */
  url: string | null;
  /** When the active link was made (UTC instant); null without a link. */
  createdAt: string | null;
}

/** What the public welcome page shows (`GET /api/public/welcome/{token}`): no personal data. */
export interface WelcomePageData {
  /** The public name of the org that runs the property: the host of the page. */
  orgName: string;
  propertyName: string;
  /** The version of the consent text, null while it has none: the page then only welcomes the guest. */
  marketingConsentVersion: string | null;
}

/**
 * What the guest typed and ticked (`POST /api/public/welcome/{token}/consent`). Every box is `false` unless the guest ticked it. The address
 * goes only with the e-mail box and the number only with the WhatsApp box: what is not consented to is not sent.
 */
export interface WelcomeConsentPayload {
  email?: string;
  phone?: string;
  consentEmail: boolean;
  consentWhatsApp: boolean;
  /** The guest declared to be of age: required, 422 `welcome_adult_required` without it. */
  adultConfirmed: boolean;
  /** The version of the consent text the page showed (`marketingConsentVersion` of the page). */
  consentVersion: string;
  /** The language of the page: the one of the confirmation e-mail. */
  language: 'it' | 'en';
}

/**
 * The answer of the consent call: always `202 { confirmationSent: true }` for a valid call, whatever was stored (a new address, a known one, a
 * confirmed one, one that opted out). The page never reads it: it would tell who is a customer.
 */
export interface WelcomeConsentResult {
  confirmationSent: boolean;
}
