export interface WelcomeLink {
  active: boolean;
  url: string | null;
  createdAt: string | null;
}

export interface WelcomePageData {
  orgName: string;
  propertyName: string;
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
  adultConfirmed: boolean;
  consentVersion: string;
  language: 'it' | 'en';
}

export interface WelcomeConsentResult {
  confirmationSent: boolean;
}
