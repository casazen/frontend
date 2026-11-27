import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement } from 'react';
import { saveInvoiceData } from '@/api/invoice-data.api';
import { useSaveInvoiceData } from '../use-invoice-data';

vi.mock('@/api/invoice-data.api', () => ({ getInvoiceData: vi.fn(), saveInvoiceData: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const FISCAL_CODE = 'RSSMRA80A01H501U';

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => createElement(QueryClientProvider, { client: queryClient }, children);
  return { queryClient, wrapper };
}

/**
 * Privacy (FIS-01): a mutation keeps what it was given and what it got back in the mutation cache for five minutes by default, after the panel
 * that made it is gone. The fiscal code, the VAT number, the PEC and the address of a guest must not stay in the browser's memory that long.
 */
describe('useSaveInvoiceData - what is typed is not kept once the panel is gone', () => {
  it('useSaveInvoiceData_Saved_LeavesNothingInTheMutationCacheOnceThePanelIsGone', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(saveInvoiceData).mockResolvedValue({ bookingId: 'b-1', invoiceRequested: false, recipientKind: 'Guest', fiscalCode: FISCAL_CODE, source: 'Host' });
    const { result, unmount } = renderHook(() => useSaveInvoiceData('b-1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ recipientKind: 'Guest', fiscalCode: FISCAL_CODE });
    });

    // While the panel that saved is there the mutation is its own: it holds what was sent and what came back...
    const held = queryClient.getMutationCache().getAll()[0];
    expect(held?.state.variables).toMatchObject({ fiscalCode: FISCAL_CODE });
    expect(held?.state.data).toMatchObject({ fiscalCode: FISCAL_CODE });

    // ...and as soon as it is gone nothing of it is left to read.
    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });

  it('useSaveInvoiceData_Refused_LeavesWhatWasTypedNowhereEither', async () => {
    const { queryClient, wrapper } = setup();
    vi.mocked(saveInvoiceData).mockRejectedValue(new Error('refused'));
    const { result, unmount } = renderHook(() => useSaveInvoiceData('b-1'), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync({ recipientKind: 'Guest', fiscalCode: FISCAL_CODE })).rejects.toThrow('refused');
    });
    expect(queryClient.getMutationCache().getAll()[0]?.state.variables).toMatchObject({ fiscalCode: FISCAL_CODE });

    unmount();
    await waitFor(() => expect(queryClient.getMutationCache().getAll()).toHaveLength(0));
  });
});
