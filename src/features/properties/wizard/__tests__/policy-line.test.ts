import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { cancellationPolicyLine } from '../rules/policy-line';

const t = i18n.getFixedT('it');

// The five policies of the catalog as the API serves them (migration SeedCancellationPolicyCatalog): hours before the arrival and %.
const CATALOG = {
  ampia: { fullRefundHours: 24, partialRefundPercent: 0, partialRefundHours: 0 },
  intermedia: { fullRefundHours: 120, partialRefundPercent: 50, partialRefundHours: 0 },
  contenuta: { fullRefundHours: 336, partialRefundPercent: 50, partialRefundHours: 168 },
  anticipata: { fullRefundHours: 720, partialRefundPercent: 50, partialRefundHours: 168 },
  non_rimborsabile: { fullRefundHours: 0, partialRefundPercent: 0, partialRefundHours: 0 },
};

describe('cancellationPolicyLine', () => {
  it('cancellationPolicyLine_FivePoliciesOfTheCatalog_SaysWhatTheNumbersDoAndNothingMore', () => {
    // The line is made of the numbers and of the calculation of the refund (100% from the first, the percent from the second,
    // nothing after): never of the description of the catalog.
    expect(cancellationPolicyLine(CATALOG.ampia, t)).toBe("Rimborso totale fino a 1 giorno prima dell'arrivo; poi nessun rimborso.");
    expect(cancellationPolicyLine(CATALOG.intermedia, t)).toBe("Rimborso totale fino a 5 giorni prima dell'arrivo; poi il 50% fino all'arrivo.");
    expect(cancellationPolicyLine(CATALOG.contenuta, t)).toBe(
      "Rimborso totale fino a 14 giorni prima dell'arrivo; poi il 50% fino a 7 giorni prima; dopo, nessun rimborso.",
    );
    expect(cancellationPolicyLine(CATALOG.anticipata, t)).toBe(
      "Rimborso totale fino a 30 giorni prima dell'arrivo; poi il 50% fino a 7 giorni prima; dopo, nessun rimborso.",
    );
    expect(cancellationPolicyLine(CATALOG.non_rimborsabile, t)).toBe('Nessun rimborso.');
  });

  it('cancellationPolicyLine_HoursThatAreNotWholeDays_AreSaidInHours', () => {
    expect(cancellationPolicyLine({ fullRefundHours: 36, partialRefundPercent: 25, partialRefundHours: 12 }, t)).toBe(
      "Rimborso totale fino a 36 ore prima dell'arrivo; poi il 25% fino a 12 ore prima; dopo, nessun rimborso.",
    );
  });
});
