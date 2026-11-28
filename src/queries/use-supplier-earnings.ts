import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { downloadSupplierEarnings, fetchSupplierEarnings } from '@/api/supplier-earnings.api';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import { todayInRome } from '@/lib/stay-dates';
import type { SupplierEarningsParams } from '@/types/supplier-earnings';

export function useSupplierEarnings(params: SupplierEarningsParams) {
  return useQuery({
    queryKey: ['supplier', 'earnings', params],
    queryFn: () => fetchSupplierEarnings(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useDownloadSupplierEarnings() {
  return useMutation({
    mutationFn: downloadSupplierEarnings,
    onSuccess: (blob) => saveBlobAs(blob, `incassi-${todayInRome()}.csv`),
    onError: (error) => toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('supplier.earnings.exportError')),
  });
}
