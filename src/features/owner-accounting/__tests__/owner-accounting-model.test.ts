import { beforeEach, describe, expect, it } from 'vitest';
import it_ from '@/i18n/locales/it.json';
import en from '@/i18n/locales/en.json';
import {
  ISSUE_CODES,
  actionForIssue,
  actionsOf,
  anomaliesOf,
  buildPayoutCommand,
  camelCode,
  changesSince,
  checkTaxYear,
  defaultPeriod,
  exceedsWhatIsLeft,
  filingLabelOf,
  forgetPayoutKeys,
  groupAnomalies,
  groupOf,
  isPeriodOver,
  isSettled,
  latestProfileStart,
  maskValue,
  nextFilingStates,
  otherActionsOf,
  ownerFinancialPath,
  ownerReadinessOn,
  parsePeriod,
  payoutKeyFor,
  payoutRuleOf,
  previewReconciliation,
  primaryActionOf,
  problemFacts,
  resolveRule,
  ruleBlockOf,
  settlePayoutKey,
  shiftPeriod,
  sourcePathOf,
  startOfPeriod,
  summarize,
  taxYearVerdict,
  type PayoutForm,
} from '../owner-accounting-model';
import type { TaxFilingState } from '@/types';
import { BOOKING_ID, OWNER_ID, VERSION_ID, entry, ownerReadiness, payout, policy, profile, readiness, version } from './owner-accounting-fixtures';

const issue = (code: string, overrides: Partial<{ ownerId: string | null; blocking: boolean; propertyId: string | null; sourceId: string | null }> = {}) => ({
  code,
  ownerId: OWNER_ID as string | null,
  propertyId: null,
  sourceId: null,
  blocking: true,
  ...overrides,
});

describe('periods', () => {
  it('parsePeriod_ReadsAMonthAndFallsBackForAnythingElse', () => {
    const fallback = { year: 2026, month: 3 };
    expect(parsePeriod('2025-11', fallback)).toEqual({ year: 2025, month: 11 });
    for (const bad of ['2025-13', '2025-00', '25-11', 'ottobre', '', null, undefined, '1999-01', '2025-1']) expect(parsePeriod(bad, fallback)).toEqual(fallback);
  });

  it('defaultPeriod_IsTheMonthBeforeToday_AcrossTheNewYear', () => {
    expect(defaultPeriod('2026-11-12')).toEqual({ year: 2026, month: 10 });
    expect(defaultPeriod('2026-01-03')).toEqual({ year: 2025, month: 12 });
  });

  it('shiftPeriod_MovesAcrossYears', () => {
    expect(shiftPeriod({ year: 2025, month: 12 }, 1)).toEqual({ year: 2026, month: 1 });
    expect(shiftPeriod({ year: 2025, month: 1 }, -1)).toEqual({ year: 2024, month: 12 });
    expect(shiftPeriod({ year: 2025, month: 6 }, 0)).toEqual({ year: 2025, month: 6 });
  });

  it('isPeriodOver_OnlyAfterItsLastDay', () => {
    expect(isPeriodOver({ year: 2026, month: 10 }, '2026-10-31')).toBe(false);
    expect(isPeriodOver({ year: 2026, month: 10 }, '2026-11-01')).toBe(true);
    expect(isPeriodOver({ year: 2026, month: 2 }, '2026-03-01')).toBe(true);
  });
});

describe('the month: groups, anomalies, percentage', () => {
  it('groupOf_FollowsTheLatestVersion', () => {
    expect(groupOf(null)).toBe('toPrepare');
    expect(groupOf('Superseded')).toBe('toPrepare');
    expect(groupOf('Draft')).toBe('toVerify');
    expect(groupOf('Flagged')).toBe('toVerify');
    expect(groupOf('Approved')).toBe('approved');
    expect(groupOf('Published')).toBe('published');
  });

  it('anomaliesOf_LeavesOutTheStepsOfTheStatementItself', () => {
    const issues = [issue('statement_missing'), issue('statement_not_approved'), issue('period_closed', { blocking: false }), issue('fx_missing'), issue('negative_balance', { blocking: false })];
    expect(anomaliesOf(issues).map((candidate) => candidate.code)).toEqual(['fx_missing', 'negative_balance']);
  });

  it('summarize_CountsTheOwnersWithoutABlockingAnomaly', () => {
    const summary = summarize(
      readiness(
        [
          ownerReadiness({ ownerId: 'a', latestStatus: null, latestVersion: null, issues: [issue('statement_missing', { ownerId: 'a' })] }),
          ownerReadiness({ ownerId: 'b', latestStatus: 'Draft', issues: [issue('fx_missing', { ownerId: 'b' })] }),
          ownerReadiness({ ownerId: 'c', latestStatus: 'Approved', issues: [issue('negative_balance', { ownerId: 'c', blocking: false })] }),
          ownerReadiness({ ownerId: 'd', status: 'Closed', latestStatus: 'Published', issues: [issue('period_closed', { ownerId: 'd', blocking: false })] }),
        ],
        [issue('ownership_missing', { ownerId: null })],
      ),
    );

    expect(summary).toMatchObject({ owners: 4, ready: 3, percent: 75, closed: 1, blocking: 2, warnings: 1, orgBlocking: 1 });
    expect(summary.groups).toEqual({ toPrepare: 1, toVerify: 1, approved: 1, published: 1 });
  });

  it('summarize_AMonthWithNoOwner_HasNoPercentage', () => {
    expect(summarize(readiness([]))).toMatchObject({ owners: 0, percent: 0, ready: 0 });
  });

  it('groupAnomalies_PutsTwelveIdenticalIssuesOnOneLine_BlockingFirst', () => {
    const many = Array.from({ length: 12 }, (_, index) => issue('unposted_source', { sourceId: `s-${index}` }));
    const groups = groupAnomalies(readiness([ownerReadiness({ issues: [...many, issue('negative_balance', { blocking: false })] })], [issue('ownership_missing', { ownerId: null })]));

    expect(groups.map((group) => [group.code, group.count, group.blocking])).toEqual([
      ['ownership_missing', 1, true],
      ['unposted_source', 12, true],
      ['negative_balance', 1, false],
    ]);
  });

  it('anIssueOfAPropertyToldTwiceByTheServer_IsCountedAndShownOnce_AndStillHoldsBackEveryOwner', () => {
    const gap = (ownerId: string | null) => issue('ownership_share_gap', { ownerId, propertyId: 'p-1' });
    const month = readiness(
      [
        ownerReadiness({ ownerId: 'a', latestStatus: 'Draft', issues: [gap('a')] }),
        ownerReadiness({ ownerId: 'b', latestStatus: 'Draft', issues: [gap('b'), issue('fx_missing', { ownerId: 'b' })] }),
        ownerReadiness({ ownerId: 'c', latestStatus: 'Draft' }),
      ],
      [gap(null)],
    );

    // The gap is one anomaly of the month (told under the month), plus the exchange rate of «b»: two lines, two anomalies.
    expect(groupAnomalies(month).map((group) => [group.ownerId, group.code])).toEqual([
      ['b', 'fx_missing'],
      [null, 'ownership_share_gap'],
    ]);
    const summary = summarize(month);
    expect(summary).toMatchObject({ blocking: 2, orgBlocking: 1, owners: 3 });
    // The owners of the property are held back all the same: only «c» is ready.
    expect(summary).toMatchObject({ ready: 1, percent: 33 });
  });

  it('actionForIssue_EveryKnownCodeHasAWayToResolveIt_AndNoneResolvesItself', () => {
    const kinds = Object.fromEntries(ISSUE_CODES.map((code) => [code, actionForIssue(issue(code, { sourceId: 'p-1' })).kind]));

    expect(kinds).toMatchObject({
      unposted_source: 'post',
      fx_missing: 'fx',
      late_source_after_close: 'correction',
      owner_fiscal_profile_missing: 'profile',
      owner_fiscal_policy_not_approved: 'profile',
      ownership_share_gap: 'onboarding',
      source_amount_missing: 'payment',
      period_dirty: 'regenerate',
      statement_missing: 'prepare',
    });
    // An unknown code of a later version says so and offers nothing it does not understand.
    expect(actionForIssue(issue('something_new')).kind).toBe('none');
    expect(actionForIssue(issue('source_amount_missing', { sourceId: null })).kind).toBe('none');
  });

  it('issueTexts_EveryCodeHasItsWordsInBothLanguages', () => {
    for (const locale of [it_, en] as const) {
      const issues = locale.ownerAccounting.issue as Record<string, { title?: string; how?: string }>;
      for (const code of ISSUE_CODES) {
        expect(issues[camelCode(code)]?.title, `${code} title`).toBeTruthy();
        expect(issues[camelCode(code)]?.how, `${code} how`).toBeTruthy();
      }
    }
  });
});

describe('what an owner row may do (actionsOf)', () => {
  const base = { status: 'Open' as const, isDirty: false, issues: [], monthOver: true };

  it('aPublishedStatementOffersNoEdit_OnlyPayingAndClosing_AndANewVersionWhenTheLedgerMoved', () => {
    const published = actionsOf({ ...base, version: { status: 'Published' } });
    expect(published).toMatchObject({ approve: false, publish: false, prepare: false, regenerate: false, payout: true, close: true });
    expect(primaryActionOf(published)).toBe('payout');
    expect(otherActionsOf(published)).toEqual(['close']);

    const stale = actionsOf({ ...base, isDirty: true, version: { status: 'Published' } });
    expect(stale).toMatchObject({ regenerate: true, publish: false, close: false, stale: true });
    expect(primaryActionOf(stale)).toBe('regenerate');
  });

  it('theStepsFollowTheStatement_PrepareApprovePublishPayClose', () => {
    expect(primaryActionOf(actionsOf({ ...base, version: null }))).toBe('prepare');
    expect(primaryActionOf(actionsOf({ ...base, version: { status: 'Flagged' } }))).toBe('regenerate');
    expect(primaryActionOf(actionsOf({ ...base, version: { status: 'Draft' } }))).toBe('approve');
    expect(primaryActionOf(actionsOf({ ...base, version: { status: 'Approved' } }))).toBe('publish');
    expect(actionsOf({ ...base, version: { status: 'Draft' } })).toMatchObject({ publish: false, close: false, payout: false });
  });

  it('aMonthIsNotClosedBeforeItIsOver_AndAClosedMonthOffersNothing', () => {
    const early = actionsOf({ ...base, monthOver: false, version: { status: 'Approved' } });
    expect(early).toMatchObject({ close: false, closeWaitsForTheEnd: true });

    const closed = actionsOf({ ...base, status: 'Closed', version: { status: 'Published' } });
    expect(Object.values(closed).every((value) => value === false)).toBe(true);
    expect(primaryActionOf(closed)).toBeNull();
  });

  it('aLedgerStatementImbalanceMakesTheVersionStaleToo', () => {
    const imbalance = actionsOf({ ...base, issues: [issue('ledger_statement_imbalance')], version: { status: 'Approved' } });
    expect(imbalance).toMatchObject({ publish: false, regenerate: true, stale: true });
  });
});

describe('reconciliation preview', () => {
  const closing = { closingBalance: 800, currency: 'EUR' };

  it('previewReconciliation_CountsOnlyTheConfirmedPayoutsOfTheMonthInTheCurrencyOfTheVersion', () => {
    const preview = previewReconciliation(
      closing,
      [
        payout({ id: 'p1', grossAmount: 500 }),
        payout({ id: 'p2', grossAmount: 300.1 }),
        payout({ id: 'p3', grossAmount: 999, status: 'Reversed' }),
        payout({ id: 'p4', grossAmount: 999, currency: 'CHF' }),
        payout({ id: 'p5', grossAmount: 999, statementVersionId: 'another-month' }),
      ],
      [VERSION_ID],
    );

    expect(preview).toMatchObject({ due: 800, paid: 800.1, difference: -0.1, needsWaiver: true, wiresCountInstead: false });
    expect(preview.payouts.map((candidate) => candidate.id)).toEqual(['p1', 'p2', 'p4']);
  });

  it('previewReconciliation_ReconcilesToTheCent_WithoutFloatingPointNoise', () => {
    const preview = previewReconciliation({ closingBalance: 0.3, currency: 'EUR' }, [payout({ grossAmount: 0.1 }), payout({ id: 'p2', grossAmount: 0.2 })], [VERSION_ID]);
    expect(preview.difference).toBe(0);
    expect(preview.needsWaiver).toBe(false);
  });

  it('previewReconciliation_ANegativeBalanceNeedsAWaiverEvenWhenItMatches', () => {
    const preview = previewReconciliation({ closingBalance: -50, currency: 'EUR' }, [], [VERSION_ID]);
    expect(preview.needsWaiver).toBe(true);
  });

  it('previewReconciliation_WithoutPayouts_SaysTheCloseCountsTheWiresInstead', () => {
    expect(previewReconciliation(closing, [], [VERSION_ID]).wiresCountInstead).toBe(true);
  });
});

describe('tax files: the word the proof allows', () => {
  const file = (filingState: TaxFilingState, handoff: string | null = null, receipt: string | null = null) => ({
    filingState,
    handoffReference: handoff,
    receiptReference: receipt,
    rejectionReason: null,
  });

  it('filingLabelOf_NeverCallsAFileSubmittedOrAcceptedWithoutItsProof', () => {
    expect(filingLabelOf(null)).toBe('calculated');
    expect(filingLabelOf(file('Generated'))).toBe('generated');
    expect(filingLabelOf(file('Reviewed'))).toBe('reviewed');
    expect(filingLabelOf(file('Submitted'))).toBe('submittedWithoutProof');
    expect(filingLabelOf(file('Submitted', '   '))).toBe('submittedWithoutProof');
    expect(filingLabelOf(file('Submitted', 'Commercialista'))).toBe('submitted');
    expect(filingLabelOf(file('Accepted', 'Commercialista'))).toBe('acceptedWithoutProof');
    expect(filingLabelOf(file('Accepted', null, 'RIC-1'))).toBe('acceptedWithoutProof');
    expect(filingLabelOf(file('Accepted', 'Commercialista', 'RIC-1'))).toBe('accepted');
    expect(filingLabelOf(file('Rejected'))).toBe('rejected');
  });

  it('nextFilingStates_FollowTheChainOfTheServer', () => {
    expect(nextFilingStates(file('Generated'))).toEqual(['Reviewed']);
    expect(nextFilingStates(file('Reviewed'))).toEqual(['Submitted']);
    expect(nextFilingStates(file('Submitted', 'x'))).toEqual(['Accepted', 'Rejected']);
    expect(nextFilingStates(file('Accepted', 'x', 'y'))).toEqual([]);
    expect(nextFilingStates(file('Rejected'))).toEqual([]);
  });
});

describe('the rule that decides a payout', () => {
  it('resolveRule_FindsTheProfileAndTheApprovedRuleInForce_AndSaysWhatBlocks', () => {
    const ok = resolveRule([profile()], [policy()], '2025-02-05');
    expect(ok.ok).toBe(true);

    expect(resolveRule([], [policy()], '2025-02-05')).toEqual({ ok: false, reason: 'profile_missing' });
    expect(resolveRule([profile({ validFrom: '2025-06-01' })], [policy()], '2025-02-05')).toEqual({ ok: false, reason: 'profile_missing' });
    expect(resolveRule([profile({ accountingPolicyId: null })], [policy()], '2025-02-05')).toEqual({ ok: false, reason: 'policy_missing' });
    expect(resolveRule([profile()], [policy({ approved: false, approvedAt: null })], '2025-02-05')).toEqual({ ok: false, reason: 'policy_not_approved' });
    expect(resolveRule([profile()], [policy({ validFrom: '2025-06-01' })], '2025-02-05')).toEqual({ ok: false, reason: 'policy_not_effective' });
    // The country does not choose the rule: a Swiss profile never takes an Italian rule set.
    expect(resolveRule([profile({ taxJurisdiction: 'CH' })], [policy()], '2025-02-05')).toEqual({ ok: false, reason: 'policy_jurisdiction_mismatch' });
  });

  it('ownerReadinessOn_AMaskedProfileStillSaysWhatIsMissing', () => {
    const missing = ownerReadinessOn([profile({ legalName: null, fiscalCode: null, settlementCurrency: '' })], [policy()], '2025-02-05');
    expect(missing).toMatchObject({ ready: false, reason: 'profile_incomplete', gaps: ['legalName', 'fiscalCode', 'settlementCurrency'] });
    expect(ownerReadinessOn([profile()], [policy()], '2025-02-05').ready).toBe(true);
  });

  it('maskValue_KeepsTheLastFourCharacters', () => {
    expect(maskValue('IT60X0542811101000000123456')).toBe('•'.repeat(23) + '3456');
    expect(maskValue('abc')).toBe('•••');
    expect(maskValue(null)).toBeNull();
    expect(maskValue('')).toBe('');
  });
});

describe('buildPayoutCommand', () => {
  const rule = (overrides: Partial<NonNullable<ReturnType<typeof policy>['parameters']>> = {}) => ({ ...policy().parameters!, ...overrides });
  const form: PayoutForm = { gross: '1.234,50', paidOn: '2025-02-05', reference: ' CRO 9 ', agencyCollected: '', qualifyingShortLet: '', components: {} };
  const ctx = { ownerId: OWNER_ID, versionId: VERSION_ID, currency: 'EUR' };

  it('aRuleWithoutWithholdingAsksNothingAndSendsNoComponents', () => {
    const built = buildPayoutCommand(form, ctx, rule(), 'key-1');
    expect(built).toEqual({
      command: {
        idempotencyKey: 'key-1',
        ownerId: OWNER_ID,
        statementVersionId: VERSION_ID,
        grossAmount: 1234.5,
        currency: 'EUR',
        paidOn: '2025-02-05',
        reference: 'CRO 9',
        agencyCollected: null,
        qualifyingShortLet: null,
        components: undefined,
      },
    });
  });

  it('aWithholdingRuleNeverDefaultsAnAnswer', () => {
    const withholding = rule({ withholdingApplies: true, withholdingRatePercent: 5, withholdingTaxCode: 'X', grossBaseComponents: ['rent', 'cleaning'] });
    const refused = buildPayoutCommand(form, ctx, withholding, 'key-1');
    expect(refused).toEqual({ errors: { agencyCollected: expect.any(String), qualifyingShortLet: expect.any(String), components: expect.any(String) } });

    const answered = buildPayoutCommand({ ...form, agencyCollected: 'no', qualifyingShortLet: 'yes', components: { rent: '100', cleaning: '0' } }, ctx, withholding, 'key-1');
    expect(answered).toMatchObject({ command: { agencyCollected: false, qualifyingShortLet: true, components: { rent: 100, cleaning: 0 } } });
  });

  it('anAmountThatIsNotPositiveOrHasTooManyDecimalsIsRefused', () => {
    for (const gross of ['', '0', '-5', '12,345', 'abc']) expect(buildPayoutCommand({ ...form, gross }, ctx, rule(), 'k')).toHaveProperty('errors.gross');
    expect(buildPayoutCommand({ ...form, paidOn: '' }, ctx, rule(), 'k')).toHaveProperty('errors.paidOn');
  });
});

describe('versions and lines', () => {
  it('changesSince_ListsTheLinesPostedAfterThePreviousCutoffAndTheFiguresThatMoved', () => {
    const before = version({ id: 'v1', version: 1, cutoffAt: '2025-01-20T08:00:00Z', revenue: 900, closingBalance: 700 });
    const after = version({ id: 'v2', version: 2, revenue: 1000, closingBalance: 800 });
    const old = entry({ id: 'old', postedAt: '2025-01-10T08:00:00Z' });
    const added = entry({ id: 'new', postedAt: '2025-02-01T08:00:00Z' });

    const changes = changesSince(after, before, [old, added]);

    expect(changes.added.map((line) => line.id)).toEqual(['new']);
    expect(changes.moved.map((figure) => figure.key)).toEqual(['revenue', 'closingBalance']);
  });

  it('sourcePathOf_OpensTheBookingByItsId_NeverByAName', () => {
    expect(sourcePathOf({ source: 'Payment', sourceId: 'pay', sourceReference: BOOKING_ID.replace(/-/g, '') })).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(sourcePathOf({ source: 'Booking', sourceId: BOOKING_ID, sourceReference: null })).toBe(`/app/short-rent/bookings/${BOOKING_ID}`);
    expect(sourcePathOf({ source: 'Payment', sourceId: 'pay', sourceReference: 'not-a-guid' })).toBe('/app/short-rent/payments/pay');
    expect(sourcePathOf({ source: 'WireBatch', sourceId: 'w', sourceReference: null })).toBe('/app/account/wire-transfers');
    expect(sourcePathOf({ source: 'Manual', sourceId: null, sourceReference: null })).toBeNull();
  });
});

describe('what the server says about a refusal', () => {
  const refused = (data: unknown, status = 422) => Object.assign(new Error('refused'), { isAxiosError: true, response: { status, data } });

  it('problemFacts_ReadsTheCodeAndTheExtensionsOfTheProblem', () => {
    expect(problemFacts(refused({ code: 'owner_close_unreconciled', due: 800, paid: 500, difference: 300 }))).toMatchObject({ status: 422, code: 'owner_close_unreconciled', figures: { due: 800, paid: 500, difference: 300 } });
    expect(problemFacts(refused({ code: 'owner_close_not_ready', issues: ['fx_missing', 7, 'unposted_source'] })).issues).toEqual(['fx_missing', 'unposted_source']);
    expect(problemFacts(refused({ code: 'owner_fiscal_profile_incomplete', fields: ['legalName', 'fiscalCode'] }))).toMatchObject({ field: 'legalName', fields: ['legalName', 'fiscalCode'] });
    expect(problemFacts(refused({ code: 'tax_applicability_unresolved', field: 'components.rent' })).field).toBe('components.rent');
  });

  it('problemFacts_AnythingElseIsNothing', () => {
    expect(problemFacts(new Error('boom'))).toEqual({ status: undefined, code: undefined, field: undefined, fields: [], issues: [], figures: null });
    expect(problemFacts(refused('<html>'))).toMatchObject({ code: undefined, figures: null });
  });

  it('ruleBlockOf_OnlyTheVerdictOfTheServerOnTheOwnerIsARuleThatBlocks', () => {
    expect(ruleBlockOf(refused({ code: 'owner_fiscal_profile_missing' }))).toBe('profile_missing');
    expect(ruleBlockOf(refused({ code: 'owner_fiscal_profile_incomplete', fields: ['legalName'] }))).toBe('profile_incomplete');
    expect(ruleBlockOf(refused({ code: 'owner_fiscal_policy_missing' }))).toBe('policy_missing');
    expect(ruleBlockOf(refused({ code: 'owner_fiscal_policy_not_approved' }))).toBe('policy_not_approved');
    expect(ruleBlockOf(refused({ code: 'owner_fiscal_policy_not_effective' }))).toBe('policy_not_effective');
    expect(ruleBlockOf(refused({ code: 'owner_fiscal_policy_jurisdiction_mismatch' }))).toBe('policy_jurisdiction_mismatch');
    // A failure that says nothing of the owner (the network, a 500, another 422) is no verdict: the owner is not told to have a rule missing.
    expect(ruleBlockOf(refused({ code: 'owner_period_closed' }))).toBeNull();
    expect(ruleBlockOf(refused({ code: 'owner_fiscal_policy_missing' }, 500))).toBeNull();
    expect(ruleBlockOf(new Error('Network Error'))).toBeNull();
  });
});

describe('the rule of a payout, as the server names it for the day', () => {
  const found = { policyId: policy().id };

  it('payoutRuleOf_TakesTheParametersOfTheRuleSetTheServerNamed', () => {
    const withholding = policy({ parameters: { ...policy().parameters!, withholdingApplies: true, withholdingRatePercent: 5, withholdingTaxCode: 'X', grossBaseComponents: ['rent'] } });
    expect(payoutRuleOf(found, [withholding])).toMatchObject({ ok: true, parameters: { withholdingApplies: true, grossBaseComponents: ['rent'] } });
  });

  it('payoutRuleOf_ARuleSetThatIsNotAmongTheOnesOfTheAgencyOrNotApprovedIsNotUsed', () => {
    expect(payoutRuleOf(found, [])).toEqual({ ok: false, reason: 'policy_missing' });
    expect(payoutRuleOf(found, [policy({ approved: false, approvedAt: null })])).toEqual({ ok: false, reason: 'policy_not_approved' });
    expect(payoutRuleOf(found, [policy({ parameters: null })])).toEqual({ ok: false, reason: 'policy_not_approved' });
  });
});

describe('the key of a payout belongs to what is asked', () => {
  const intent = { ownerId: OWNER_ID, statementVersionId: VERSION_ID, grossAmount: 800, paidOn: '2025-02-05' };

  beforeEach(() => forgetPayoutKeys());

  it('payoutKeyFor_TheSameFactsAreTheSameKey_UntilTheServerConfirmedThePayout', () => {
    const first = payoutKeyFor(intent);
    // A retry, a second click, the dialog opened again: the same request, so the same key.
    expect(payoutKeyFor({ ...intent })).toBe(first);
    expect(payoutKeyFor({ ...intent, grossAmount: 800.0 })).toBe(first);
    // Another amount, another day, another statement or another owner is another payout.
    expect(payoutKeyFor({ ...intent, grossAmount: 800.01 })).not.toBe(first);
    expect(payoutKeyFor({ ...intent, paidOn: '2025-02-06' })).not.toBe(first);
    expect(payoutKeyFor({ ...intent, statementVersionId: 'other' })).not.toBe(first);
    expect(payoutKeyFor({ ...intent, ownerId: 'other' })).not.toBe(first);

    // Confirmed: the same facts again are a second payment of the same amount, which must not be answered with the first one.
    settlePayoutKey(intent);
    expect(payoutKeyFor(intent)).not.toBe(first);
  });

  it('buildPayoutCommand_TakesTheKeyFromTheFactsOfThePayoutOnceTheAmountIsKnown', () => {
    const form: PayoutForm = { gross: '800,00', paidOn: '2025-02-05', reference: '', agencyCollected: '', qualifyingShortLet: '', components: {} };
    const ctx = { ownerId: OWNER_ID, versionId: VERSION_ID, currency: 'EUR' };
    const first = buildPayoutCommand(form, ctx, policy().parameters!, payoutKeyFor);
    const again = buildPayoutCommand({ ...form, gross: '800' }, ctx, policy().parameters!, payoutKeyFor);
    expect(first).toHaveProperty('command.idempotencyKey');
    expect('command' in first && 'command' in again && first.command.idempotencyKey === again.command.idempotencyKey).toBe(true);
    // An amount that is refused makes no key.
    expect(buildPayoutCommand({ ...form, gross: '0' }, ctx, policy().parameters!, payoutKeyFor)).toHaveProperty('errors.gross');
  });

  it('exceedsWhatIsLeft_AnAmountOverTheResidue_OrAnyAmountWhenNothingIsLeft', () => {
    expect(exceedsWhatIsLeft(300, 300)).toBe(false);
    expect(exceedsWhatIsLeft(300, 300.01)).toBe(true);
    expect(exceedsWhatIsLeft(0, 1)).toBe(true);
    expect(exceedsWhatIsLeft(-50, 1)).toBe(true);
    expect(exceedsWhatIsLeft(null, 1000)).toBe(false);
    expect(exceedsWhatIsLeft(300, null)).toBe(false);
  });
});

describe('a statement that is already paid is closed, not paid again', () => {
  const base = { status: 'Open' as const, isDirty: false, issues: [], monthOver: true };
  const closing = { closingBalance: 800, currency: 'EUR' };

  it('isSettled_WhenTheConfirmedPayoutsCoverTheBalance_OrThereIsNothingOwed', () => {
    expect(isSettled(closing, [payout({ grossAmount: 800 })], [VERSION_ID])).toBe(true);
    expect(isSettled(closing, [payout({ grossAmount: 500 })], [VERSION_ID])).toBe(false);
    expect(isSettled(closing, [], [VERSION_ID])).toBe(false);
    // A reversed payout pays nothing, and a payout of another currency is no payment of this statement.
    expect(isSettled(closing, [payout({ grossAmount: 800, status: 'Reversed' })], [VERSION_ID])).toBe(false);
    expect(isSettled(closing, [payout({ grossAmount: 800, currency: 'CHF' })], [VERSION_ID])).toBe(false);
    expect(isSettled({ closingBalance: 0, currency: 'EUR' }, [], [VERSION_ID])).toBe(true);
  });

  it('primaryActionOf_PaidInFull_PutsTheCloseFirst_AndWaitsWhenTheMonthIsNotOver', () => {
    const unpaid = actionsOf({ ...base, version: { status: 'Published' }, settled: false });
    expect(primaryActionOf(unpaid)).toBe('payout');
    expect(otherActionsOf(unpaid)).toEqual(['close']);

    const paid = actionsOf({ ...base, version: { status: 'Published' }, settled: true });
    expect(primaryActionOf(paid)).toBe('close');
    // The payment stays available, in the menu, for an extra one.
    expect(otherActionsOf(paid)).toEqual(['payout']);

    // Paid, but the month is not over: nothing to do until it is.
    const waiting = actionsOf({ ...base, monthOver: false, version: { status: 'Published' }, settled: true });
    expect(primaryActionOf(waiting)).toBeNull();
    expect(waiting.closeWaitsForTheEnd).toBe(true);

    // What is not known (the payments not read yet) is not paid.
    expect(primaryActionOf(actionsOf({ ...base, version: { status: 'Published' } }))).toBe('payout');
    // An approved statement is first published, paid or not.
    expect(primaryActionOf(actionsOf({ ...base, version: { status: 'Approved' }, settled: true }))).toBe('publish');
  });
});

describe('the year of the withholdings against the F24 and the annual data', () => {
  const month = (m: number, obligations: number, f24: number | null) => ({ month: m, obligations, f24, filingState: f24 === null ? null : ('Generated' as const) });

  it('checkTaxYear_AYearWithNothingInItMatchesNothing', () => {
    const empty = checkTaxYear({ obligationsTotal: 0, annualTotal: null, months: [] });
    expect(empty).toEqual({ f24: 'none', months: [], annual: null });
    expect(taxYearVerdict(empty)).toBe('empty');
  });

  it('taxYearVerdict_ReconciledNeedsAnF24ThatMatchesAndAnnualDataThatMatch', () => {
    const f24Only = checkTaxYear({ obligationsTotal: 120, annualTotal: null, months: [month(1, 120, 120)] });
    expect(f24Only.annual).toBeNull();
    // Annual data that does not exist is not said to match.
    expect(taxYearVerdict(f24Only)).toBe('f24Matches');

    const both = checkTaxYear({ obligationsTotal: 120, annualTotal: 120, months: [month(1, 120, 120)] });
    expect(taxYearVerdict(both)).toBe('reconciled');

    const annualOnly = checkTaxYear({ obligationsTotal: 0, annualTotal: 0, months: [] });
    expect(taxYearVerdict(annualOnly)).toBe('annualMatches');
  });

  it('checkTaxYear_SaysWhichOfTheTwoDoesNotMatch', () => {
    // The F24 are what the withholdings say; the annual data generated earlier is not.
    const annualOff = checkTaxYear({ obligationsTotal: 500, annualTotal: 400, months: [month(1, 500, 500)] });
    expect(annualOff.f24).toBe('matches');
    expect(annualOff.annual).toEqual({ total: 400, matches: false });
    expect(taxYearVerdict(annualOff)).toBe('differs');

    // The annual data match; one F24 is not what the withholdings of its month say, and one month has withholdings and no F24 yet.
    const f24Off = checkTaxYear({ obligationsTotal: 300, annualTotal: 300, months: [month(1, 100, 100), month(2, 100, 90), month(3, 100, null)] });
    expect(f24Off.f24).toBe('differs');
    expect(f24Off.months).toEqual([
      { month: 2, obligations: 100, f24: 90 },
      { month: 3, obligations: 100, f24: null },
    ]);
    expect(f24Off.annual).toEqual({ total: 300, matches: true });
    expect(taxYearVerdict(f24Off)).toBe('differs');
  });

  it('checkTaxYear_ComparesInCents_WithoutFloatingPointNoise', () => {
    expect(checkTaxYear({ obligationsTotal: 0.3, annualTotal: 0.3, months: [month(1, 0.1 + 0.2, 0.3)] }).f24).toBe('matches');
  });
});

describe('the profile of an owner and the days it covers', () => {
  it('ownerReadinessOn_SaysFromWhichDayTheDataHolds', () => {
    const ready = ownerReadinessOn([profile({ validFrom: '2025-03-01' })], [policy({ validFrom: '2025-01-01' })], '2025-04-10');
    expect(ready).toMatchObject({ ready: true, from: '2025-03-01' });
    // The rule set that starts later is the one that decides: the data holds from the day both apply.
    const later = ownerReadinessOn([profile({ validFrom: '2025-01-01' })], [policy({ validFrom: '2025-02-01' })], '2025-04-10');
    expect(later).toMatchObject({ ready: true, from: '2025-02-01' });
  });

  it('latestProfileStart_ANewProfileMustStartAfterIt', () => {
    expect(latestProfileStart([])).toBeNull();
    expect(latestProfileStart([profile({ validFrom: '2024-01-01' }), profile({ validFrom: '2025-06-01' }), profile({ validFrom: '2025-02-01' })])).toBe('2025-06-01');
  });

  it('ownerFinancialPath_CarriesTheMonthThatSentThePersonThere', () => {
    expect(ownerFinancialPath(OWNER_ID)).toBe(`/app/account/owners/${OWNER_ID}/financial`);
    expect(ownerFinancialPath(OWNER_ID, { year: 2025, month: 1 })).toBe(`/app/account/owners/${OWNER_ID}/financial?period=2025-01`);
    expect(startOfPeriod({ year: 2025, month: 1 })).toBe('2025-01-01');
  });
});
