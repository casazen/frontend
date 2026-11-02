import { useMutation } from '@tanstack/react-query';
import { swissComplianceApi } from '@/api/swissCompliance.api';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import type {
  TicinoNotificationRequest,
  OtrReportRequest,
  UploadSwissReceiptForm,
} from '@/types/swissCompliance.types';

export function useGeneratePoliceXml(propertyId: string) {
  return useMutation({
    mutationFn: (request: TicinoNotificationRequest) =>
      swissComplianceApi.generatePoliceXml(propertyId, request),
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.police.downloadFailed'));
    },
  });
}

export function useGenerateOtrCsv(propertyId: string) {
  return useMutation({
    mutationFn: (request: OtrReportRequest) => swissComplianceApi.generateOtrCsv(propertyId, request),
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.otr.downloadFailed'));
    },
  });
}

export function useUploadReceipt(propertyId: string) {
  return useMutation({
    mutationFn: (form: UploadSwissReceiptForm) => swissComplianceApi.uploadReceipt(propertyId, form),
    onSuccess: () => {
      toast.success(i18n.t('swiss.receipt.uploadSuccess'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('swiss.receipt.uploadFailed'));
    },
  });
}
