// The addresses and the steps of the wizard «Fatturazione» (E11/F02/US01): plain constants with no import, so that the onboarding guide, which opens the wizard at the
// step that is missing, and the pages that lead to it know them without loading the wizard.

/** The fiscal page of the area: the card «Fatturazione» is on it, and the wizard returns to it. */
export const FISCAL_PATH = '/app/short-rent/fiscal';

/** The home of the area, where the confirmation leads besides the fiscal page. */
export const AREA_HOME_PATH = '/app/short-rent';

/** The wizard «Fatturazione» (E11/F02/US01/T01, NF-82, NF-118): the whole invoicing setup of the organization, a part of the onboarding guide. `?step=` carries the step. */
export const BILLING_SETUP_PATH = '/app/short-rent/fiscal/setup';

/** The old wizard «Come emetti i documenti?» (E06/F02/US02/T03): its address stays and leads to {@link BILLING_SETUP_PATH}. */
export const LEGACY_ISSUER_PATH = '/app/short-rent/fiscal/issuer';

/**
 * The steps of the wizard, by the name `?step=` carries, in the order of the wizard. The steps «Commissioni dei canali» and «Mandato standard» exist only for an agency, and
 * «Italia» only for an Italian issuer; «Commercialista» (E15/F02/US02/T01, optional) only while the package of the accountant is on (the flag `accountantPackage`); the others are always there.
 */
export const BILLING_STEPS = {
  issuer: 'issuer',
  vat: 'vat',
  numbering: 'numbering',
  touristTax: 'tourist-tax',
  channels: 'channels',
  mandate: 'mandate',
  issuing: 'issuing',
  italy: 'italy',
  accountant: 'accountant',
  summary: 'summary',
} as const;

export type BillingStepId = (typeof BILLING_STEPS)[keyof typeof BILLING_STEPS];

/** Every step in the order of the wizard. */
export const BILLING_STEP_ORDER: readonly BillingStepId[] = [
  BILLING_STEPS.issuer,
  BILLING_STEPS.vat,
  BILLING_STEPS.numbering,
  BILLING_STEPS.touristTax,
  BILLING_STEPS.channels,
  BILLING_STEPS.mandate,
  BILLING_STEPS.issuing,
  BILLING_STEPS.italy,
  BILLING_STEPS.accountant,
  BILLING_STEPS.summary,
];

/** The steps of the old wizard «Come emetti i documenti?» and the step of the new one that holds what they asked. The choice of the issuer is gone, with its step. */
const LEGACY_STEPS: Readonly<Record<string, BillingStepId>> = {
  regime: BILLING_STEPS.vat,
  issuer: BILLING_STEPS.issuer,
  address: BILLING_STEPS.issuer,
  summary: BILLING_STEPS.summary,
};

/** The query of the new address for the query of the old one: the step it points at, when the new wizard has one for it; nothing otherwise (the wizard then opens at what is missing). */
export function searchOfLegacy(search: string): string {
  const step = new URLSearchParams(search).get('step');
  const target = step && Object.hasOwn(LEGACY_STEPS, step) ? LEGACY_STEPS[step] : undefined;
  return target ? `?step=${encodeURIComponent(target)}` : '';
}
