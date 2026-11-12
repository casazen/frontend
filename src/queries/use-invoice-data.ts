import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getInvoiceData, saveInvoiceData } from '@/api/invoice-data.api';
import i18n from '@/i18n/config';
import type { SaveInvoiceDataRequest } from '@/types';

/** Root of the query keys of the invoice data: one entry for each booking. */
export const INVOICE_DATA_KEY = 'invoice-data';

/**
 * Who the invoice of a booking is made out to (FIS-01). The guest writes it at the check-in and the import of the channel manager fills it while the
 * host has the booking open, and the client does not read an unobserved query again by default (`refetchOnMount: false`), so it is read again
 * whenever the section or the sub-step opens. Fiscal data of a guest is not kept in the browser once the booking is left (`gcTime: 0`).
 * `enabled: false` for who may not read payments (`payment.read`): the API refuses them.
 */
export function useInvoiceData(bookingId: string, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [INVOICE_DATA_KEY, bookingId],
    queryFn: () => getInvoiceData(bookingId),
    enabled: Boolean(bookingId) && (options.enabled ?? true),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
  });
}

/**
 * Saves the invoice data as the host. The data that comes back is the one on screen from then on, and the query is read again. A refusal is left to
 * the caller: the 422 that names fields is shown on those fields, any other problem in the panel that asked.
 */
export function useSaveInvoiceData(bookingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SaveInvoiceDataRequest) => saveInvoiceData(bookingId, data),
    onSuccess: async (saved) => {
      queryClient.setQueryData([INVOICE_DATA_KEY, bookingId], saved);
      await queryClient.invalidateQueries({ queryKey: [INVOICE_DATA_KEY, bookingId] });
      toast.success(i18n.t('invoiceData.saved'));
    },
  });
}
