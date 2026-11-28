import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { rentApi, rentBankImportApi, rentRegisterApi } from '@/api/rent.api';
import type { BankColumnMapping, BankImportSelection, MarkRentPaidInput, RentRegisterParams } from '@/types';
import { LEASES_KEY } from './use-leases';
import { RENT_KEY, RENT_REGISTER_KEY } from './use-rent';

export function useRentRegister(params: RentRegisterParams) {
  return useQuery({
    queryKey: [RENT_REGISTER_KEY, params],
    queryFn: () => rentRegisterApi.getRegister(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

export function useRentRegisterActions() {
  const queryClient = useQueryClient();

  const refresh = (leaseId: string) => {
    void queryClient.invalidateQueries({ queryKey: [RENT_REGISTER_KEY] });
    void queryClient.invalidateQueries({ queryKey: [RENT_KEY, leaseId] });
    void queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
  };

  return {
    sendReminder: async (leaseId: string, installmentId: string, note?: string) => {
      try {
        return await rentRegisterApi.sendReminder(installmentId, note);
      } finally {
        refresh(leaseId);
      }
    },

    sendWhatsAppReminder: async (leaseId: string, installmentId: string, note?: string) => {
      try {
        return await rentRegisterApi.sendWhatsAppReminder(installmentId, note);
      } finally {
        refresh(leaseId);
      }
    },

    markPaid: async (leaseId: string, installmentId: string, input: MarkRentPaidInput) => {
      try {
        return await rentApi.markPaid(leaseId, installmentId, input);
      } finally {
        refresh(leaseId);
      }
    },

    previewBankStatement: (file: File, mapping?: BankColumnMapping) => rentBankImportApi.preview(file, mapping),

    confirmBankStatement: async (file: File, selections: BankImportSelection[], mapping?: BankColumnMapping) => {
      try {
        return await rentBankImportApi.confirm(file, selections, mapping);
      } finally {
        void queryClient.invalidateQueries({ queryKey: [RENT_REGISTER_KEY] });
        void queryClient.invalidateQueries({ queryKey: [RENT_KEY] });
        void queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
      }
    },
  };
}
