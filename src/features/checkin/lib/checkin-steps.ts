export const STEP_SCAN = 1;
export const STEP_GUESTS = 2;
export const STEP_DOCUMENT = 3;
export const STEP_CONSENTS = 5;
export const STEP_IDENTITY = 6;
export const STEP_TAX = 7;
export const STEP_LABEL: Record<number, string> = {
  [STEP_SCAN]: 'checkin.stepScan',
  [STEP_GUESTS]: 'checkin.stepGuests',
  [STEP_DOCUMENT]: 'checkin.stepDocument',
  [STEP_IDENTITY]: 'checkin.stepIdentity',
  [STEP_TAX]: 'checkin.touristTax.title',
  [STEP_CONSENTS]: 'checkin.stepConsents',
};

/** Every step in the order the page shows them: the steps that are not in `stepsOf` are skipped, and the step that follows one that went away is found here. */
const STEP_ORDER: readonly number[] = [STEP_SCAN, STEP_GUESTS, STEP_DOCUMENT, STEP_TAX, STEP_IDENTITY, STEP_CONSENTS];

/**
 * The steps of the page in order. The identity step is there only while the API offers the identity verification (`identityVerification` in the
 * context), the tax step only while it offers the tourist tax payment (the flag on, the organization offering it, its account ready): with both off the
 * page has the steps it has always had.
 */
export function stepsOf(identity: boolean, tax: boolean): readonly number[] {
  return STEP_ORDER.filter((candidate) => (candidate === STEP_IDENTITY ? identity : candidate === STEP_TAX ? tax : true));
}

/** The step a guest is at when the one they were at went away while the page was open (the verification or the tax payment was switched off): the one that follows it. */
export function stepAfterGone(gone: number, steps: readonly number[]): number {
  return STEP_ORDER.slice(STEP_ORDER.indexOf(gone) + 1).find((candidate) => steps.includes(candidate)) ?? STEP_CONSENTS;
}
