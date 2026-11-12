import { describe, expect, it } from 'vitest';
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
  defaultPeriod,
  filingLabelOf,
  groupAnomalies,
  groupOf,
  isPeriodOver,
  maskValue,
  nextFilingStates,
  otherActionsOf,
  ownerReadinessOn,
  parsePeriod,
  previewReconciliation,
  primaryActionOf,
  problemFacts,
  resolveRule,
  shiftPeriod,
  sourcePathOf,
  summarize,
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
});
