import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fiscalApi,
  type FiscalExportFormat,
  type FiscalReportKind,
  type FiscalReportPeriod,
  type FiscalTaxProfileUpdate,
  type StrFiscalRegime,
} from '@/api/fiscal.api';

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
    mutationFn: (body: FiscalTaxProfileUpdate) => fiscalApi.putTaxProfile(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useFiscalAnnualReport(taxYear: number, period: FiscalReportPeriod) {
  return useQuery({
    queryKey: [KEY, 'annual', taxYear, period.from, period.to],
    queryFn: () => fiscalApi.getAnnual(taxYear, period),
  });
}

export function useFiscalWithholdingReport(taxYear: number, period: FiscalReportPeriod) {
  return useQuery({
    queryKey: [KEY, 'withholding', taxYear, period.from, period.to],
    queryFn: () => fiscalApi.getWithholding(taxYear, period),
  });
}

export function useTouristTaxReport(period: FiscalReportPeriod) {
  return useQuery({
    queryKey: [KEY, 'tourist-tax', period.from, period.to],
    queryFn: () => fiscalApi.getTouristTax(period),
  });
}

/** Downloads a report as CSV or PDF (the caller saves the blob and shows the error). */
export function useDownloadFiscalReport() {
  return useMutation({
    mutationFn: (args: {
      kind: FiscalReportKind;
      taxYear: number;
      period: FiscalReportPeriod;
      format: FiscalExportFormat;
    }) => fiscalApi.downloadReport(args.kind, args.taxYear, args.period, args.format),
  });
}
