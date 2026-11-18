import type { BillingPlan, PlanTier, RentalType } from '@/types';

export type SignupProfile = 'agency' | 'owner' | 'supplier' | 'long-rent';
export interface CommercialSelection {
  profile: Exclude<SignupProfile, 'supplier'>;
  planTier: PlanTier;
  rentalArea?: RentalType;
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
  includedInPlans?: PlanTier[];
  ownerOffer?: { priceMonthly: number | null; purchasable: boolean };
}
export function addonsForTier(catalog: CommercialAddon[], tier: PlanTier): CommercialAddon[] {
  return catalog.map(addon => addon.includedInPlans?.includes(tier)
    ? { ...addon, priceMonthly: 0, purchasable: true }
    : (tier === 'Pro' || tier === 'Scale') && addon.ownerOffer ? { ...addon, ...addon.ownerOffer } : addon);
}
export const signupRentalType = (selection: CommercialSelection): RentalType => selection.rentalArea ?? (selection.profile === 'long-rent' ? 'LongTerm' : 'ShortTerm');
export const allowsExtras = (tier: PlanTier) => tier !== 'Starter';
export const billingQuantity = (selection: CommercialSelection) => selection.profile === 'agency' ? selection.rooms : 1;
export function applicableAddons(addons: CommercialAddon[], area: RentalType) {
  const context = area === 'LongTerm' ? 'long-rent' : 'short-rent';
  return addons.filter(addon => area === 'Both' || addon.context === 'all' || addon.context === context);
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
