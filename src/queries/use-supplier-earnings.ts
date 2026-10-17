import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { downloadSupplierEarnings, fetchSupplierEarnings } from '@/api/supplier-earnings.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { todayInRome } from '@/lib/stay-dates';
import type { SupplierEarningsParams } from '@/types/supplier-earnings';

/** The earnings of the supplier for a state of the list; the rows of the last answer stay, a little dimmed, until the next arrive. */
export function useSupplierEarnings(params: SupplierEarningsParams) {
  return useQuery({
    queryKey: ['supplier', 'earnings', params],
    queryFn: () => fetchSupplierEarnings(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/** "Scarica il riepilogo": the CSV the server makes for the filters of the list, saved as a file. A refusal says why (the server's words). */
export function useDownloadSupplierEarnings() {
  return useMutation({
    mutationFn: downloadSupplierEarnings,
    onSuccess: (blob) => saveBlobAs(blob, `incassi-${todayInRome()}.csv`),
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('supplier.earnings.exportError')),
  });
}
