import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { rentApi, rentRegisterApi } from '@/api/rent.api';
import type { MarkRentPaidInput, RentRegisterParams } from '@/types';
import { LEASES_KEY } from './use-leases';
import { RENT_KEY, RENT_REGISTER_KEY } from './use-rent';

/**
 * A page of the rent register (LR-04b). The rows of the last month stay on the screen, a little dimmed, while the next ones
 * come. Other pages change the rents (a plan saved, an installment paid), so the register is read again every time it opens.
 */
export function useRentRegister(params: RentRegisterParams) {
  return useQuery({
    queryKey: [RENT_REGISTER_KEY, params],
    queryFn: () => rentRegisterApi.getRegister(params),
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
  });
}

/**
 * What the landlord does from the register. They are plain calls and not mutations of the page: they run when the six seconds
 * of «Annulla» are over (`holdForUndo`), when the page that asked may be gone. Each one reads again what it may have changed
 * (the register, the rent of the lease, the list of leases with its late rents), whether it worked or not: a paid-meanwhile
 * installment or a payment in flight shows its real state.
 */
export function useRentRegisterActions() {
  const queryClient = useQueryClient();

  const refresh = (leaseId: string) => {
    void queryClient.invalidateQueries({ queryKey: [RENT_REGISTER_KEY] });
    void queryClient.invalidateQueries({ queryKey: [RENT_KEY, leaseId] });
    void queryClient.invalidateQueries({ queryKey: [LEASES_KEY] });
  };

  return {
    /** Emails the tenants of one installment. Only the landlord's own action ever calls it. */
    sendReminder: async (leaseId: string, installmentId: string, note?: string) => {
      try {
        return await rentRegisterApi.sendReminder(installmentId, note);
      } finally {
        refresh(leaseId);
      }
    },

    /** Declares an installment paid outside CasaZen (bank transfer, cheque, cash). */
    markPaid: async (leaseId: string, installmentId: string, input: MarkRentPaidInput) => {
      try {
        return await rentApi.markPaid(leaseId, installmentId, input);
      } finally {
        refresh(leaseId);
      }
    },
  };
}
