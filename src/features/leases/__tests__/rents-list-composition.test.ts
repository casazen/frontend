import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import type { RentRegisterRow } from '@/types';
import { buildRentsList } from '../rents-list';

const t = ((key: string) => key) as TFunction;

function row(overrides: Partial<RentRegisterRow> = {}): RentRegisterRow {
  return {
    id: 'inst-1',
    leaseId: 'lease-1',
    propertyId: 'property-1',
    propertyName: 'Casa',
    tenantFirstName: 'Giulia',
    tenantLastName: 'Verdi',
    tenantAnonymized: false,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    dueDate: '2026-11-05',
    amount: 1050,
    currency: 'EUR',
    status: 'Scheduled',
    isOverdue: false,
    daysOverdue: null,
    paidVia: null,
    paidOn: null,
    paymentRequestedAt: null,
    lastReminderAt: null,
    reminderCount: 0,
    canRemind: false,
    ...overrides,
  };
}

function csv(installment: RentRegisterRow, id: string) {
  const list = buildRentsList(t, 'it', { canManage: false, held: new Set(), onRecord: () => {}, onRemind: () => {} });
  return list.columns.find((column) => column.id === id)?.csv?.(installment);
}

describe('rent register composition columns', () => {
  it('keeps the amount column a number and splits the parts into their own columns', () => {
    const installment = row({
      components: [
        { kind: 'Rent', amount: 900 },
        { kind: 'CondominiumAdvance', amount: 150 },
      ],
    });

    expect(csv(installment, 'amount')).toBe(1050);
    expect(csv(installment, 'rent')).toBe(900);
    expect(csv(installment, 'advance')).toBe(150);
    expect(csv(installment, 'settlement')).toBe(0);
    expect(csv(installment, 'other')).toBe(0);
    expect(csv(installment, 'paid')).toBe(0);
    expect(csv(installment, 'residual')).toBe(1050);
    expect(String(csv(installment, 'amount'))).not.toContain(' ');
  });

  it('exports only the current total when the API has no components', () => {
    const installment = row({ amount: 950, components: undefined });
    expect(csv(installment, 'amount')).toBe(950);
    expect(csv(installment, 'rent')).toBe('');
    expect(csv(installment, 'advance')).toBe('');
  });

  it('offers the Stripe transfer only when the org can take the rent online', () => {
    const euro = row({ status: 'Scheduled', currency: 'EUR' });
    const dollar = row({ status: 'Scheduled', currency: 'USD' });
    const options = {
      canManage: true,
      held: new Set<string>(),
      onRecord: () => {},
      onRemind: () => {},
      onStripePay: () => {},
    };
    const hasStripe = (list: ReturnType<typeof buildRentsList>, installment: RentRegisterRow) =>
      list.menu?.(installment)?.some((entry) => entry !== 'separator' && entry.id === 'stripe') === true;
    const offline = buildRentsList(t, 'it', { ...options, onlinePaymentsAvailable: false });
    const online = buildRentsList(t, 'it', { ...options, onlinePaymentsAvailable: true });

    expect(hasStripe(offline, dollar)).toBe(false);
    expect(hasStripe(online, euro)).toBe(false);
    expect(hasStripe(online, dollar)).toBe(true);
  });
});
