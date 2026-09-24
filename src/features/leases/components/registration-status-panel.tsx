import { useState } from 'react';
import { AlertTriangle, Clock, Download, ExternalLink, FileCheck2, Loader2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@/lib/utils';
import { leasesApi } from '@/api/leases.api';
import {
  getRliRegistrationState,
  RLI_OFFICIAL_INFO_URL,
  RLI_REGISTRATION_PANEL_ID,
} from '@/lib/rli-registration-state';
import { getRliFailureLabel, getRliRegistrationStateLabel } from '@/lib/i18n-labels';
import { RLI_REGISTRATION_STATE_VARIANTS } from '../schemas/lease.schema';
import { ManualRegistrationDialog } from './manual-registration-dialog';
import type { LeaseRegistration, LeaseStatus } from '@/types';

interface RegistrationStatusPanelProps {
  leaseId: string;
  leaseStatus: LeaseStatus;
  registration?: LeaseRegistration | null;
  /** Legal deadline of the registration as computed by the API (LT-04); shown, never recomputed here. */
  registrationDeadline: string;
  /** The provider path exists (flag on and configured provider, from the RLI checklist). */
  providerFilingAvailable: boolean;
  onSubmitToProvider?: () => void;
  isSubmittingToProvider?: boolean;
}

/**
 * RLI registration of a lease (LT-01, A7-01). Honest states: "to register" (with the steps to register on the official
 * channel and the manual declaration), "in progress" (provider only: not registered yet), "registered" (details and
 * receipt) and "failed" (reason and the ways forward). Nothing is presented as registered before the registration is
 * recorded with its receipt.
 */
export function RegistrationStatusPanel({
  leaseId,
  leaseStatus,
  registration,
  registrationDeadline,
  providerFilingAvailable,
  onSubmitToProvider,
  isSubmittingToProvider,
}: RegistrationStatusPanelProps) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const state = getRliRegistrationState(leaseStatus, registration);
  const canRegister = state === 'toRegister' || state === 'failed';
  const canUseProvider = canRegister && providerFilingAvailable && !!onSubmitToProvider;

  const handleDownloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const blob = await leasesApi.downloadReceipt(leaseId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ricevuta-rli-${leaseId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t('leases.rli.receiptOk'));
    } catch {
      toast.error(t('leases.rli.receiptError'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card id={RLI_REGISTRATION_PANEL_ID} data-testid="rli-registration-panel">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>{t('leases.rli.registrationTitle')}</CardTitle>
            <CardDescription>{t('leases.rli.registrationDescription')}</CardDescription>
          </div>
          <Badge variant={RLI_REGISTRATION_STATE_VARIANTS[state]} data-testid="rli-registration-state">
            {getRliRegistrationStateLabel(state, t)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {state === 'notSigned' && <p className="text-muted-foreground">{t('leases.rli.notSignedHint')}</p>}

        {state === 'failed' && (
          <div role="alert" className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3">
            <p className="flex items-start gap-2 font-medium text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t(canUseProvider ? 'leases.rli.failedHintWithRetry' : 'leases.rli.failedHint')}
            </p>
            <p>
              <span className="text-muted-foreground">{t('leases.rli.failureReason')}: </span>
              {getRliFailureLabel(registration?.failureCode, t)}
            </p>
          </div>
        )}

        {canRegister && (
          <>
            <p className="font-medium">{t('leases.rli.deadline', { date: formatDate(registrationDeadline) })}</p>
            <div className="space-y-2 rounded-md border p-3" data-testid="rli-manual-steps">
              <p className="font-medium">{t('leases.rli.manualSteps.title')}</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>{t('leases.rli.manualSteps.step1')}</li>
                <li>{t('leases.rli.manualSteps.step2')}</li>
                <li>{t('leases.rli.manualSteps.step3')}</li>
              </ol>
              <a
                href={RLI_OFFICIAL_INFO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
              >
                {t('leases.rli.manualSteps.officialLink')}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              <p className="text-xs text-muted-foreground">{t('leases.rli.manualSteps.notIntermediary')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => setManualOpen(true)}>
                <FileCheck2 className="mr-2 h-4 w-4" />
                {t('leases.rli.declareManual')}
              </Button>
              {canUseProvider && (
                <Button variant="outline" onClick={onSubmitToProvider} disabled={isSubmittingToProvider}>
                  {isSubmittingToProvider ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('leases.rli.submitting')}
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {t(state === 'failed' ? 'leases.rli.retryProvider' : 'leases.rli.submit')}
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}

        {state === 'inProgress' && (
          <div role="status" className="space-y-2 rounded-md border p-3">
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {t('leases.rli.inProgressHint')}
            </p>
            {registration?.submittedAt && (
              <p className="text-muted-foreground">
                {t('leases.rli.submitted')} {formatDateTime(registration.submittedAt)}
              </p>
            )}
            <p className="text-muted-foreground">{t('leases.rli.deadline', { date: formatDate(registrationDeadline) })}</p>
          </div>
        )}

        {state === 'registered' && registration && (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              {registration.registrationCode && (
                <div>
                  <dt className="text-muted-foreground">{t('leases.rli.registrationCode')}</dt>
                  <dd className="font-mono font-medium">{registration.registrationCode}</dd>
                </div>
              )}
              {registration.registrationDate && (
                <div>
                  <dt className="text-muted-foreground">{t('leases.rli.registrationDate')}</dt>
                  <dd className="font-medium">{formatDate(registration.registrationDate)}</dd>
                </div>
              )}
              <div>
                <dt className="text-muted-foreground">{t('leases.rli.channel')}</dt>
                <dd className="font-medium">{t(`leases.rli.channelLabel.${registration.channel}`)}</dd>
              </div>
              {registration.confirmedAt && (
                <div>
                  <dt className="text-muted-foreground">{t('leases.rli.confirmed')}</dt>
                  <dd className="font-medium">{formatDateTime(registration.confirmedAt)}</dd>
                </div>
              )}
            </dl>
            {registration.hasReceipt && (
              <Button variant="outline" onClick={handleDownloadReceipt} disabled={isDownloading}>
                {isDownloading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('leases.rli.downloading')}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {t('leases.rli.downloadReceipt')}
                  </>
                )}
              </Button>
            )}
          </>
        )}
      </CardContent>
      <ManualRegistrationDialog leaseId={leaseId} open={manualOpen} onOpenChange={setManualOpen} />
    </Card>
  );
}
