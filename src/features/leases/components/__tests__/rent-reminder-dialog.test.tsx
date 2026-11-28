import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import axios from '@/lib/axios';
import { toastUndo } from '@/lib/toast-undo';
import type { RentRegisterRow } from '@/types';
import { RentReminderDialog } from '../rent-reminder-dialog';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/lib/toast-undo', () => ({ toastUndo: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const post = vi.mocked(axios.post);

function row(id: string): RentRegisterRow {
  return {
    id,
    leaseId: 'lease-1',
    propertyId: 'property-1',
    propertyName: 'Casa Trastevere',
    tenantFirstName: 'Giulia',
    tenantLastName: 'Verdi',
    tenantAnonymized: false,
    periodStart: '2026-10-01',
    periodEnd: '2026-10-31',
    dueDate: '2026-10-05',
    amount: 950,
    currency: 'EUR',
    status: 'Scheduled',
    isOverdue: true,
    daysOverdue: 19,
    paidVia: null,
    paidOn: null,
    paymentRequestedAt: null,
    lastReminderAt: null,
    reminderCount: 0,
    canRemind: true,
  };
}

function renderDialog(installment: RentRegisterRow) {
  const onClose = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <I18nextProvider i18n={i18n}>
        <RentReminderDialog row={installment} onlinePaymentsAvailable={false} intervalHours={24} onClose={onClose} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return { onClose };
}

describe('RentReminderDialog (LR-04b)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('confirm_ThenAnnulla_NothingIsEverSentToTheTenant', () => {
    const { onClose } = renderDialog(row('installment-a'));

    fireEvent.change(screen.getByLabelText('Messaggio per il conduttore'), { target: { value: 'Grazie' } });
    expect(post).not.toHaveBeenCalled();
    expect(toastUndo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Invia sollecito' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(toastUndo).toHaveBeenCalledTimes(1);
    expect(post).not.toHaveBeenCalled();

    vi.mocked(toastUndo).mock.calls[0][1].undo();
    expect(post).not.toHaveBeenCalled();
  });

  it('confirm_SixSecondsPass_SendsOneReminderWithTheNote', async () => {
    post.mockResolvedValue({
      data: {
        installmentId: 'installment-b',
        sentAt: '2026-10-24T09:00:00Z',
        reminderCount: 1,
        recipientCount: 2,
        includesPaymentLink: false,
        nextReminderAllowedAt: '2026-10-25T09:00:00Z',
      },
    });
    renderDialog(row('installment-b'));

    fireEvent.change(screen.getByLabelText('Messaggio per il conduttore'), { target: { value: ' Grazie ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia sollecito' }));
    expect(post).not.toHaveBeenCalled();

    await vi.mocked(toastUndo).mock.calls[0][1].commit?.();

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/long-rent/rents/installment-b/reminder', { note: 'Grazie' }, undefined);
    expect(toast.success).toHaveBeenCalledWith('Sollecito inviato a 2 conduttori');
  });

  it('phoneOnly_SendsTheWhatsAppTemplateWithoutAnEmailAddress', async () => {
    post.mockResolvedValue({
      data: {
        installmentId: 'installment-c',
        sentAt: '2026-10-24T09:00:00Z',
        recipientCount: 1,
        nextReminderAllowedAt: '2026-10-25T09:00:00Z',
      },
    });
    const invalidate = vi.spyOn(QueryClient.prototype, 'invalidateQueries');
    renderDialog({ ...row('installment-c'), canRemind: false, hasTenantPhone: true, canWhatsAppRemind: true });

    expect(screen.queryByRole('button', { name: 'Invia sollecito' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Messaggio per il conduttore'), { target: { value: ' Grazie ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Invia via WhatsApp' }));

    await waitFor(() => expect(post).toHaveBeenCalledWith(
      '/long-rent/rents/installment-c/reminder/whatsapp',
      { note: 'Grazie' },
      undefined,
    ));
    expect(toast.success).toHaveBeenCalledWith('Promemoria WhatsApp inviato a 1 conduttore');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['long-rent-rents'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['lease-rent', 'lease-1'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['leases'] });
    invalidate.mockRestore();
  });
});
