import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MarkSentManuallyButton } from '../components/resend-button';
import { alloggiatiApi } from '@/api/alloggiati.api';
import type { AlloggiatiStatusDto, AlloggiatiWebStatus } from '@/types/alloggiati.types';

vi.mock('@/api/alloggiati.api', () => ({
  alloggiatiApi: { getSummary: vi.fn(), getStatus: vi.fn(), getGuestSummary: vi.fn(), markSentManually: vi.fn() },
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// Radix Checkbox measures itself with ResizeObserver, which jsdom does not provide.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock);

const BOOKING_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function renderButton(status: AlloggiatiWebStatus, reportedAt: string | null = null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MarkSentManuallyButton, {
        bookingId: BOOKING_ID,
        status,
        checkInDate: '2026-10-10T00:00:00Z',
        reportedAt,
      }),
    ),
  );
}

describe('MarkSentManuallyButton (CO-11)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T08:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    cleanup();
  });

  it('button_SentWithReceipt_IsDisabledAndCannotResend', () => {
    renderButton('Inviato', '2026-10-10T00:00:00Z');
    const button = screen.getByTestId('alloggiati-resend-button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Inviato il 10/10/2026');
  });

  it('button_DeclaredSent_IsDisabledWithTheDeclaredDate', () => {
    renderButton('InviatoManualmente', '2026-10-11T00:00:00Z');
    const button = screen.getByTestId('alloggiati-resend-button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Inviato manualmente il 11/10/2026');
  });

  it('button_BeforeArrivalDay_IsDisabled', () => {
    renderButton('DaInviare');
    expect(screen.getByTestId('alloggiati-resend-button')).toBeDisabled();
    expect(screen.getByText('Disponibile dal giorno di arrivo')).toBeInTheDocument();
  });

  it('button_ToSendManually_RequiresConfirmationAndSendsTheChosenDate', async () => {
    const sent: AlloggiatiStatusDto = {
      bookingId: BOOKING_ID,
      status: 'InviatoManualmente',
      confirmationNumber: null,
      errorCode: null,
      reportedAt: '2026-10-10T00:00:00Z',
      deadlineAt: '2026-10-10T22:00:00Z',
      isShortStay: false,
      hoursUntilDeadline: 0,
      isOverdue: false,
      dataComplete: true,
    };
    vi.mocked(alloggiatiApi.markSentManually).mockResolvedValue(sent);
    renderButton('DaInviareManualmente');

    const button = screen.getByTestId('alloggiati-resend-button');
    expect(button).toHaveTextContent('Segna come inviato manualmente');
    fireEvent.click(button);

    const dateInput = screen.getByTestId('alloggiati-sent-on') as HTMLInputElement;
    expect(dateInput.value).toBe('2026-10-11'); // today in Europe/Rome
    expect(dateInput.min).toBe('2026-10-10');
    expect(dateInput.max).toBe('2026-10-11');
    const submit = screen.getByTestId('alloggiati-mark-sent-confirm');
    expect(submit).toBeDisabled();

    fireEvent.change(dateInput, { target: { value: '2026-10-10' } });
    fireEvent.click(screen.getByTestId('alloggiati-sent-confirm'));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() =>
      expect(alloggiatiApi.markSentManually).toHaveBeenCalledWith(BOOKING_ID, { sentOn: '2026-10-10' }),
    );
  });

  it('button_DateInTheFuture_CannotBeConfirmed', () => {
    renderButton('DaInviareManualmente');
    fireEvent.click(screen.getByTestId('alloggiati-resend-button'));

    fireEvent.change(screen.getByTestId('alloggiati-sent-on'), { target: { value: '2026-10-12' } });
    fireEvent.click(screen.getByTestId('alloggiati-sent-confirm'));

    expect(screen.getByTestId('alloggiati-mark-sent-confirm')).toBeDisabled();
    expect(screen.getByText('Scegli una data tra il 10/10/2026 e il 11/10/2026.')).toBeInTheDocument();
  });
});
