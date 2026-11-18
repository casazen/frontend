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
  agencyIncluded?: boolean;
  agencyPurchasable?: boolean;
  agencyPriceMonthly?: number | null;
}
export const signupRentalType = (selection: CommercialSelection): RentalType => selection.rentalArea ?? (selection.profile === 'long-rent' ? 'LongTerm' : 'ShortTerm');
export const allowsExtras = (tier: PlanTier) => tier !== 'Starter';
export function applicableAddons(addons: CommercialAddon[], area: RentalType) {
  const context = area === 'LongTerm' ? 'long-rent' : 'short-rent';
  return addons.filter(addon => area === 'Both' || addon.context === 'all' || addon.context === context);
}
/** Unknown display prices never become a zero euro promise. Stripe remains authoritative. */
export function commercialUnitPrice(plan: BillingPlan | undefined, addons: CommercialAddon[], selection: CommercialSelection): number | null {
  if (!plan || !plan.purchasable || plan.priceMonthly <= 0) return null;
  let total = plan.priceMonthly;
  for (const code of selection.addons) {
    const addon = addons.find(item => item.code === code);
    if (!addon?.purchasable || addon.priceMonthly === null || addon.currency !== plan.currency) return null;
    total += addon.priceMonthly;
  }
  return total;
}

export function agencyBaseEstimate(tariff: BillingPlan['agencyTariff'], units: number): number | null {
  if (!tariff || !Number.isSafeInteger(units) || units < 0 || units >= tariff.quoteFrom) return null;
  const band = tariff.bands.find(band => units <= band.upTo);
  return band ? Math.max(tariff.minimum, units * band.unitPrice) : null;
}
