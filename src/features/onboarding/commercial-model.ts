import type { BillingPlan, PlanTier, RentalType } from '@/types';

export type SignupProfile = 'agency' | 'owner' | 'supplier' | 'long-rent';
export interface CommercialSelection {
  profile: Exclude<SignupProfile, 'supplier'>;
  planTier: PlanTier;
  rooms: number;
  agencyName?: string;
  addons: string[];
}
export interface CommercialAddon {
  code: string;
  context: 'short-rent' | 'long-rent' | 'all';
  priceMonthly: number | null;
  currency: string;
  purchasable: boolean;
}
export const signupRentalType = (profile: SignupProfile): RentalType => profile === 'long-rent' ? 'LongTerm' : 'ShortTerm';
export const allowsExtras = (tier: PlanTier) => tier !== 'Starter';
export const billingQuantity = (selection: CommercialSelection) => selection.profile === 'agency' ? selection.rooms : 1;
export function applicableAddons(addons: CommercialAddon[], profile: SignupProfile) {
  const context = profile === 'long-rent' ? 'long-rent' : 'short-rent';
  return addons.filter(addon => addon.context === 'all' || addon.context === context);
}
/** Unknown display prices never become a zero euro promise. Stripe remains authoritative. */
export function commercialTotal(plan: BillingPlan | undefined, addons: CommercialAddon[], selection: CommercialSelection): number | null {
  if (!plan || !plan.purchasable || plan.priceMonthly <= 0) return null;
  let total = plan.priceMonthly;
  for (const code of selection.addons) {
    const addon = addons.find(item => item.code === code);
    if (!addon?.purchasable || addon.priceMonthly === null || addon.currency !== plan.currency) return null;
    total += addon.priceMonthly;
  }
  return total * billingQuantity(selection);
}
