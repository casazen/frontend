import type { StayDiscountTier } from '@/types';

/** The limits of the backend (`PropertyStayDiscount`): at most 5 tiers, each from 2 to 365 nights, a percentage above 0 and at most 100. */
export const MAX_STAY_DISCOUNTS = 5;
export const MIN_DISCOUNT_NIGHTS = 2;
export const MAX_DISCOUNT_NIGHTS = 365;
export const MAX_DISCOUNT_PERCENT = 100;

/** A tier as typed: both fields are text until the step is checked. */
export interface StayDiscountDraft {
  minNights: string;
  percentOff: string;
}

/** The tiers the server has, as the fields of the wizard. */
export function stayDiscountDraftsFromServer(tiers: readonly StayDiscountTier[]): StayDiscountDraft[] {
  return tiers.map((tier) => ({ minNights: String(tier.minNights), percentOff: String(tier.percentOff) }));
}

/** A whole number of nights from 2 to 365, or `null`. */
export function parseNights(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,3}$/.test(value)) return null;
  const nights = Number(value);
  return nights >= MIN_DISCOUNT_NIGHTS && nights <= MAX_DISCOUNT_NIGHTS ? nights : null;
}

/** A percentage above 0 and at most 100, with up to two decimals and a comma or a point, or `null`. */
export function parsePercent(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(value)) return null;
  const percent = Number(value.replace(',', '.'));
  return percent > 0 && percent <= MAX_DISCOUNT_PERCENT ? percent : null;
}

/** A row the host added and left empty: it says nothing and is not sent. */
export const isBlankTier = (draft: StayDiscountDraft): boolean => draft.minNights.trim() === '' && draft.percentOff.trim() === '';

/**
 * The tiers to save: the rows that are filled in, in order of nights. A row that is not valid is the schema's to refuse before this runs;
 * here it is simply left out, so a half-typed row never reaches the server as a discount of 0.
 */
export function stayDiscountTiers(drafts: readonly StayDiscountDraft[]): StayDiscountTier[] {
  const tiers: StayDiscountTier[] = [];
  for (const draft of drafts) {
    const minNights = parseNights(draft.minNights);
    const percentOff = parsePercent(draft.percentOff);
    if (minNights !== null && percentOff !== null) tiers.push({ minNights, percentOff });
  }
  return tiers.sort((a, b) => a.minNights - b.minNights);
}

/** What is wrong with a row, as the field and the i18n key of the message, or `null` when it is fine (or empty). */
export function stayDiscountProblem(
  drafts: readonly StayDiscountDraft[],
  index: number,
): { field: 'minNights' | 'percentOff'; message: string } | null {
  const draft = drafts[index]!;
  if (isBlankTier(draft)) return null;
  const nights = parseNights(draft.minNights);
  if (nights === null) return { field: 'minNights', message: 'propertyWizard.validation.stayDiscounts.minNights' };
  if (parsePercent(draft.percentOff) === null) return { field: 'percentOff', message: 'propertyWizard.validation.stayDiscounts.percentOff' };
  const sameNights = drafts.findIndex((other) => parseNights(other.minNights) === nights);
  if (sameNights !== index) return { field: 'minNights', message: 'propertyWizard.validation.stayDiscounts.duplicate' };
  return null;
}
