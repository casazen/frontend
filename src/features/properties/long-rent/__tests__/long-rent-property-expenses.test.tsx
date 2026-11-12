import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import type { LeaseSummary, RentInstallment, RentInstallmentStatus } from '@/types';
import { ExpensesPanel } from '../long-rent-property-panels';

const ledger = vi.hoisted(() => ({
  current: {
    data: undefined as { installments: RentInstallment[]; manualNotices: [] } | undefined,
    isLoading: false,
    isError: false,
    error: null as unknown,
    refetch: vi.fn(),
  },
}));

vi.mock('@/queries/use-rent', () => ({
  useRentLedger: () => ledger.current,
}));

vi.mock('@/lib/stay-dates', async () => {
  const actual = await vi.importActual<typeof import('@/lib/stay-dates')>('@/lib/stay-dates');
  return { ...actual, todayInRome: () => '2026-11-09' };
});

const LEASE = {
  id: 'lease-1',
  status: 'Active',
  startDate: '2026-01-01',
  tenantFirstName: 'Giulia',
  tenantLastName: 'Verdi',
} as LeaseSummary;

function installment(
  id: string,
  status: RentInstallmentStatus,
  periodStart: string,
  extra: RentInstallment['components'] = [
    { kind: 'Rent', amount: 900 },
    { kind: 'CondominiumAdvance', amount: 80 },
  ],
): RentInstallment {
  return {
    id,
    periodStart,
    periodEnd: periodStart.replace(/-01$/, '-28'),
    dueDate: periodStart.replace(/-01$/, '-05'),
    amount: 980,
    currency: 'EUR',
    status,
    isOverdue: status === 'Failed',
    paidVia: status === 'Paid' ? 'Offline' : null,
    paidOn: status === 'Paid' ? periodStart.replace(/-01$/, '-06') : null,
    offlinePaymentNote: null,
    paymentRequestedAt: null,
    failureCode: null,
    lastFailedAt: null,
    components: extra,
  };
}

function show(installments: RentInstallment[]) {
  ledger.current = { data: { installments, manualNotices: [] }, isLoading: false, isError: false, error: null, refetch: vi.fn() };
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <ExpensesPanel leases={[LEASE]} />
      </MemoryRouter>
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

describe('property condominium situation', () => {
  it('shows the open installment that covers today, not the sum of the ledger', () => {
    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '12'];
    const paid = months.map((month) =>
      installment(`paid-${month}`, 'Paid', `2026-${month}-01`, [
        { kind: 'Rent', amount: 900 },
        { kind: 'CondominiumAdvance', amount: 80 },
        ...(month === '10' ? [{ kind: 'CondominiumSettlement' as const, amount: 200 }] : []),
      ]),
    );
    show([
      ...paid,
      installment('cancelled', 'Cancelled', '2025-12-01', [
        { kind: 'CondominiumAdvance', amount: 500 },
        { kind: 'CondominiumSettlement', amount: 300 },
      ]),
      installment('current', 'Scheduled', '2026-11-01'),
    ]);

    const situation = screen.getByTestId('long-rent-property-condo-situation-lease-1');
    expect(situation).toHaveTextContent(/Acconto condominiale: 80,00/);
    expect(situation).toHaveTextContent(/Conguaglio: 0,00/);
    expect(situation).not.toHaveTextContent('960,00');
    expect(situation).not.toHaveTextContent('200,00');
    expect(situation).not.toHaveTextContent('500,00');
  });

  it('uses the latest open due when the installment that covers today is already paid', () => {
    show([
      installment('october', 'Failed', '2026-10-01', [
        { kind: 'CondominiumAdvance', amount: 80 },
        { kind: 'CondominiumSettlement', amount: 40 },
      ]),
      installment('november', 'Paid', '2026-11-01', [{ kind: 'CondominiumAdvance', amount: 80 }]),
      installment('december', 'Scheduled', '2026-12-01', [{ kind: 'CondominiumAdvance', amount: 90 }]),
    ]);

    const situation = screen.getByTestId('long-rent-property-condo-situation-lease-1');
    expect(situation).toHaveTextContent(/Acconto condominiale: 80,00/);
    expect(situation).toHaveTextContent(/Conguaglio: 40,00/);
    expect(situation).not.toHaveTextContent('90,00');
    expect(situation).not.toHaveTextContent('170,00');
  });

  it('keeps the latest paid charge when nothing is still open', () => {
    show([
      installment('october', 'Paid', '2026-10-01', [
        { kind: 'CondominiumAdvance', amount: 80 },
        { kind: 'CondominiumSettlement', amount: 200 },
      ]),
      installment('november', 'Paid', '2026-11-01', [
        { kind: 'CondominiumAdvance', amount: 80 },
        { kind: 'CondominiumSettlement', amount: 15 },
      ]),
    ]);

    const situation = screen.getByTestId('long-rent-property-condo-situation-lease-1');
    expect(situation).toHaveTextContent(/Acconto condominiale: 80,00/);
    expect(situation).toHaveTextContent(/Conguaglio: 15,00/);
    expect(situation).not.toHaveTextContent('200,00');
    expect(situation).not.toHaveTextContent('160,00');
  });
});
