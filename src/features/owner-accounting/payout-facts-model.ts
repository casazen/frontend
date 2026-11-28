import type { TFunction } from 'i18next';
import type { OwnerPayoutPreview } from '@/types';
import { camelCode, ruleBlockOfCode, toCents, type RuleBlock } from './owner-accounting-model';

/**
 * The codes of the facts of a stay of a payout that this version of the app has words for (the cross-repo contract of the backend: `ShortLetTreatmentReasons` and `PayoutStayReasons`, `OwnerWithholdingRules`). A code that is
 * not here is shown as it came: the person can still tell which one the server means, and nothing is ever hidden because the app has no word for it.
 */
export const QUALIFYING_REASONS = [
  'short_let',
  'owner_presumed_business',
  'company_tenant_short_let',
  'company_tenant_not_short_let',
  'stay_not_active',
  'property_not_italian',
  'stay_length_out_of_range',
  'owner_not_private',
] as const;

export const COLLECTIONS = ['casazen_payment', 'recorded_payment', 'portal_pays_agency', 'portal_pays_owner', 'collected_at_property', 'payment_not_recorded'] as const;

export const PORTAL_WITHHOLDINGS = ['payment', 'portal_rule'] as const;

export const STAY_VERDICTS = ['in_base', 'already_withheld_by_portal', 'not_qualifying_short_let', 'no_collection_or_intervention'] as const;

export const DECISION_REASONS = [
  'applicable',
  'rule_without_withholding',
  'no_collection_or_intervention',
  'not_qualifying_short_let',
  'already_withheld_by_portal',
  'no_stays_to_decide',
] as const;

type FactGroup = 'qualifying' | 'collection' | 'portalWithholding' | 'verdict';

const FACT_CODES: Readonly<Record<FactGroup, readonly string[]>> = {
  qualifying: QUALIFYING_REASONS,
  collection: COLLECTIONS,
  portalWithholding: PORTAL_WITHHOLDINGS,
  verdict: STAY_VERDICTS,
};

export function factWords(t: TFunction, group: FactGroup, code: string): string {
  return FACT_CODES[group].includes(code) ? t(`ownerAccounting.facts.${group}.${camelCode(code)}`) : t('ownerAccounting.facts.otherCode', { code });
}

export function decisionReasonWords(t: TFunction, code: string): string {
  return (DECISION_REASONS as readonly string[]).includes(code) ? t(`ownerAccounting.tax.reason.${camelCode(code)}`) : t('ownerAccounting.tax.reason.other', { code });
}

export type PayoutBlock =
  | { kind: 'rule'; reason: RuleBlock }
  | { kind: 'nothingLeft' }
  | { kind: 'unresolved'; field: string | null }
  | { kind: 'other'; code: string };

export function payoutBlockOf(preview: Pick<OwnerPayoutPreview, 'blockingCode' | 'blockingField' | 'balance'>): PayoutBlock | null {
  const code = preview.blockingCode;
  if (!code) return toCents(preview.balance) <= 0 ? { kind: 'nothingLeft' } : null;
  const rule = ruleBlockOfCode(code);
  if (rule) return { kind: 'rule', reason: rule };
  if (code === 'owner_payout_exceeds_balance') return { kind: 'nothingLeft' };
  if (code === 'tax_applicability_unresolved') return { kind: 'unresolved', field: preview.blockingField };
  return { kind: 'other', code };
}
