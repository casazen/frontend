import type { StayDiscountTier } from '@/types';

export const MAX_STAY_DISCOUNTS = 5;
export const MIN_DISCOUNT_NIGHTS = 2;
export const MAX_DISCOUNT_NIGHTS = 365;
export const MAX_DISCOUNT_PERCENT = 100;

export interface StayDiscountDraft {
  minNights: string;
  percentOff: string;
}

export function stayDiscountDraftsFromServer(tiers: readonly StayDiscountTier[]): StayDiscountDraft[] {
  return tiers.map((tier) => ({ minNights: String(tier.minNights), percentOff: String(tier.percentOff) }));
}

export function parseNights(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,3}$/.test(value)) return null;
  const nights = Number(value);
  return nights >= MIN_DISCOUNT_NIGHTS && nights <= MAX_DISCOUNT_NIGHTS ? nights : null;
}

export function parsePercent(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(value)) return null;
  const percent = Number(value.replace(',', '.'));
  return percent > 0 && percent <= MAX_DISCOUNT_PERCENT ? percent : null;
}

export const isBlankTier = (draft: StayDiscountDraft): boolean => draft.minNights.trim() === '' && draft.percentOff.trim() === '';

export function stayDiscountTiers(drafts: readonly StayDiscountDraft[]): StayDiscountTier[] {
  const tiers: StayDiscountTier[] = [];
  for (const draft of drafts) {
    const minNights = parseNights(draft.minNights);
    const percentOff = parsePercent(draft.percentOff);
    if (minNights !== null && percentOff !== null) tiers.push({ minNights, percentOff });
  }
  return tiers.sort((a, b) => a.minNights - b.minNights);
}

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
