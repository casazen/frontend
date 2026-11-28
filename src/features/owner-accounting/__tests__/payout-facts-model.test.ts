import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';
import { camelCode } from '../owner-accounting-model';
import { COLLECTIONS, DECISION_REASONS, PORTAL_WITHHOLDINGS, QUALIFYING_REASONS, STAY_VERDICTS, decisionReasonWords, factWords, payoutBlockOf } from '../payout-facts-model';
import { cuOwnerIdsOf, taxExportFallbackName } from '../tax-exports-model';

describe('payoutBlockOf: what the preview of a payout says would be refused', () => {
  const ok = { blockingCode: null, blockingField: null, balance: 800 };

  it('payoutBlockOf_NothingToRefuseAndABalance_IsNoBlock', () => {
    expect(payoutBlockOf(ok)).toBeNull();
  });

  it('payoutBlockOf_ARuleThatIsNotUsable_IsTheRuleThatBlocks_AndTheWayIsTheDataOfTheOwner', () => {
    expect(payoutBlockOf({ ...ok, blockingCode: 'owner_fiscal_policy_not_approved' })).toEqual({ kind: 'rule', reason: 'policy_not_approved' });
    expect(payoutBlockOf({ ...ok, blockingCode: 'owner_fiscal_profile_incomplete' })).toEqual({ kind: 'rule', reason: 'profile_incomplete' });
  });

  it('payoutBlockOf_NothingLeftToPay_FromTheCodeOrFromTheBalance', () => {
    expect(payoutBlockOf({ ...ok, blockingCode: 'owner_payout_exceeds_balance', balance: 0 })).toEqual({ kind: 'nothingLeft' });
    expect(payoutBlockOf({ ...ok, balance: 0 })).toEqual({ kind: 'nothingLeft' });
    expect(payoutBlockOf({ ...ok, balance: -12.5 })).toEqual({ kind: 'nothingLeft' });
  });

  it('payoutBlockOf_AFactTheRuleCouldNotResolve_NamesTheField_AndAnyOtherCodeIsToldByItsCode', () => {
    expect(payoutBlockOf({ ...ok, blockingCode: 'tax_applicability_unresolved', blockingField: 'fxRate' })).toEqual({ kind: 'unresolved', field: 'fxRate' });
    expect(payoutBlockOf({ ...ok, blockingCode: 'owner_statement_not_approved' })).toEqual({ kind: 'other', code: 'owner_statement_not_approved' });
  });
});

describe('the codes of the facts have words in both languages', () => {
  const groups = [
    ['qualifying', QUALIFYING_REASONS],
    ['collection', COLLECTIONS],
    ['portalWithholding', PORTAL_WITHHOLDINGS],
    ['verdict', STAY_VERDICTS],
  ] as const;

  it.each(['it', 'en'])('factWords_EveryCodeOfTheContract_HasItsOwnWordsIn_%s_NotTheCodeAsItCame', (language) => {
    const t = i18n.getFixedT(language) as TFunction;
    for (const [group, codes] of groups) {
      for (const code of codes) {
        const words = factWords(t, group, code);
        expect(words, `${group}.${code}`).not.toMatch(/^ownerAccounting\./);
        if (code.includes('_')) expect(words, `${group}.${code}`).not.toContain(code);
      }
    }
    for (const code of DECISION_REASONS) {
      const words = decisionReasonWords(t, code);
      expect(words, code).not.toMatch(/^ownerAccounting\./);
      if (code.includes('_')) expect(words, code).not.toContain(code);
    }
  });

  it('factWords_ACodeThisVersionDoesNotKnow_IsShownAsItCame_NeverHidden', () => {
    const t = i18n.getFixedT('it') as TFunction;
    expect(factWords(t, 'collection', 'something_new')).toContain('something_new');
    expect(decisionReasonWords(t, 'something_new')).toContain('something_new');
  });

  it('camelCode_MakesTheKeyOfEveryCode', () => {
    expect(camelCode('already_withheld_by_portal')).toBe('alreadyWithheldByPortal');
  });
});

describe('the files of the withholding of the agency', () => {
  it('taxExportFallbackName_NamesTheFileByItsKindAndItsPeriod_NeverByAnOwnerOrAProperty', () => {
    expect(taxExportFallbackName({ kind: 'f24', year: 2026, month: 3, format: 'csv' })).toBe('f24-2026-03-dati.csv');
    expect(taxExportFallbackName({ kind: 'cu', year: 2026, format: 'xlsx' })).toBe('certificazione-unica-2026.xlsx');
    expect(taxExportFallbackName({ kind: 'cuProspect', year: 2026, ownerId: 'o-1' })).toBe('prospetto-cu-2026.pdf');
    expect(taxExportFallbackName({ kind: 'tax770', year: 2026, format: 'csv' })).toBe('modello-770-2026.csv');
    expect(taxExportFallbackName({ kind: 'contracts', year: 2026, format: 'xlsx' })).toBe('comunicazione-contratti-2026.xlsx');
  });

  it('cuOwnerIdsOf_ReadsTheOwnersOfTheTotalsOfTheAnnualData_EachOnce', () => {
    const payload = JSON.stringify([
      { ownerId: 'o-1', grossBase: 100, withheld: 21, evidence: 1 },
      { ownerId: 'o-2', grossBase: 200, withheld: 42, evidence: 2 },
      { ownerId: 'o-1', grossBase: 50, withheld: 10.5, evidence: 1 },
    ]);
    expect(cuOwnerIdsOf(payload)).toEqual(['o-1', 'o-2']);
    expect(cuOwnerIdsOf('[]')).toEqual([]);
  });

  it('cuOwnerIdsOf_APayloadThatIsNotTheListOfTotals_IsNullAndNeverAnEmptyList', () => {
    for (const bad of ['', 'not json', '{"rows":[]}', '[null]', '[{"grossBase":1}]', '[{"ownerId":""}]', '[{"ownerId":7}]']) expect(cuOwnerIdsOf(bad), bad).toBeNull();
  });
});
