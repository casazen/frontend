import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fiscalApi, type StrFiscalRegime } from '@/api/fiscal.api';

const KEY = 'fiscal';

export function useFiscalRegime(taxYear: number) {
  return useQuery({
    queryKey: [KEY, 'regime', taxYear],
    queryFn: () => fiscalApi.getRegime(taxYear),
  });
}

export function useAssignFiscalRegime(taxYear: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { propertyId: string; regime: StrFiscalRegime; isPrimaryForCedolare?: boolean }) =>
      fiscalApi.assignRegime(args.propertyId, {
        taxYear,
        regime: args.regime,
        isPrimaryForCedolare: args.isPrimaryForCedolare,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useFiscalTaxProfile() {
  return useQuery({
    queryKey: [KEY, 'tax-profile'],
    queryFn: () => fiscalApi.getTaxProfile(),
  });
}

export function useUpdateFiscalTaxProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fiscalApi.putTaxProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useFiscalAnnualReport(taxYear: number) {
  return useQuery({
    queryKey: [KEY, 'annual', taxYear],
    queryFn: () => fiscalApi.getAnnual(taxYear),
  });
}

export function useFiscalWithholdingReport(taxYear: number) {
  return useQuery({
    queryKey: [KEY, 'withholding', taxYear],
    queryFn: () => fiscalApi.getWithholding(taxYear),
  });
}
