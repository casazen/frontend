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

/** Why the portal is taken to have withheld already: the payment says so, or the portal is one that withholds for the Italian private hosts (⚖ R5). */
export const PORTAL_WITHHOLDINGS = ['payment', 'portal_rule'] as const;

/** Where a stay ends up. */
export const STAY_VERDICTS = ['in_base', 'already_withheld_by_portal', 'not_qualifying_short_let', 'no_collection_or_intervention'] as const;

/** The reasons of a withholding decision (`OwnerWithholdingRules`): applicable or why it is not. */
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

/** The words of a code of the facts of a stay: the ones of this version, or the code as it came. */
export function factWords(t: TFunction, group: FactGroup, code: string): string {
  return FACT_CODES[group].includes(code) ? t(`ownerAccounting.facts.${group}.${camelCode(code)}`) : t('ownerAccounting.facts.otherCode', { code });
}

/** The words of the reason of a withholding decision: the ones of this version, or the code as it came. */
export function decisionReasonWords(t: TFunction, code: string): string {
  return (DECISION_REASONS as readonly string[]).includes(code) ? t(`ownerAccounting.tax.reason.${camelCode(code)}`) : t('ownerAccounting.tax.reason.other', { code });
}

/** What stops a payout that the preview of it says the server would refuse. */
export type PayoutBlock =
  /** The owner's profile or the rule set of the day is not usable (`owner_fiscal_*`): the way out is the owner's financial data. */
  | { kind: 'rule'; reason: RuleBlock }
  /** The version owes nothing more: the payments cover its balance. */
  | { kind: 'nothingLeft' }
  /** A fact the rule needs could not be resolved (`tax_applicability_unresolved`); `field` names it (`fxRate` for an owner paid in another currency with no rate of the day). */
  | { kind: 'unresolved'; field: string | null }
  /** Any other refusal of the server, told by its code. */
  | { kind: 'other'; code: string };

/**
 * The block of a payout, from the preview of the server: the code the confirmation would answer (`blockingCode`), or a balance that is gone. `null` when the payout can be confirmed. The decision is the server's:
 * this only sorts its codes into the words of the dialog.
 */
export function payoutBlockOf(preview: Pick<OwnerPayoutPreview, 'blockingCode' | 'blockingField' | 'balance'>): PayoutBlock | null {
  const code = preview.blockingCode;
  if (!code) return toCents(preview.balance) <= 0 ? { kind: 'nothingLeft' } : null;
  const rule = ruleBlockOfCode(code);
  if (rule) return { kind: 'rule', reason: rule };
  if (code === 'owner_payout_exceeds_balance') return { kind: 'nothingLeft' };
  if (code === 'tax_applicability_unresolved') return { kind: 'unresolved', field: preview.blockingField };
  return { kind: 'other', code };
}
