import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { paymentsApi } from '@/api/payments.api';
import type { RecordPaymentInput, RefundPaymentDto } from '@/types';
import { FISCAL_DOCUMENTS_KEY } from '../use-fiscal-documents';
import { useCreatePayment, useRefundPayment } from '../use-payments';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/api/payments.api', () => ({ paymentsApi: { create: vi.fn(), refund: vi.fn() } }));

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

function seedTheDocumentsOfABooking(queryClient: QueryClient) {
  const key = [...FISCAL_DOCUMENTS_KEY, 'booking', 'b-1'];
  queryClient.setQueryData(key, []);
  return () => queryClient.getQueryState(key)?.isInvalidated === true;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the collection of a fiscal document follows the payments', () => {
  it('UseCreatePayment_APaymentIsRecorded_MakesTheFiscalDocumentsStaleSoTheirCollectionIsReadAgain', async () => {
    vi.mocked(paymentsApi.create).mockResolvedValue({} as never);
    const { queryClient, wrapper } = setup();
    const isStale = seedTheDocumentsOfABooking(queryClient);
    const { result } = renderHook(() => useCreatePayment(), { wrapper });
    expect(isStale()).toBe(false);

    await act(async () => {
      await result.current.mutateAsync({ bookingId: 'b-1' } as RecordPaymentInput);
    });

    expect(isStale()).toBe(true);
  });

  it('UseRefundPayment_ARefundIsAsked_MakesTheFiscalDocumentsStaleSoTheirCollectionIsReadAgain', async () => {
    vi.mocked(paymentsApi.refund).mockResolvedValue({} as never);
    const { queryClient, wrapper } = setup();
    const isStale = seedTheDocumentsOfABooking(queryClient);
    const { result } = renderHook(() => useRefundPayment(), { wrapper });
    expect(isStale()).toBe(false);

    await act(async () => {
      await result.current.mutateAsync({ id: 'p-1', data: {} as RefundPaymentDto });
    });

    expect(isStale()).toBe(true);
  });

  it('UseRefundPayment_TheRefundIsRefused_ReadsTheFiscalDocumentsAgainToo', async () => {
    vi.mocked(paymentsApi.refund).mockRejectedValue(new Error('refused'));
    const { queryClient, wrapper } = setup();
    const isStale = seedTheDocumentsOfABooking(queryClient);
    const { result } = renderHook(() => useRefundPayment(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'p-1', data: {} as RefundPaymentDto }).catch(() => undefined);
    });

    expect(isStale()).toBe(true);
  });
});
