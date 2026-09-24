import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLease, useRliChecklist, useTriggerRegistration } from '@/queries/use-leases';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { LeaseStatusBadge } from './components/lease-status-badge';
import { LeaseSigningPanel } from './components/lease-signing-panel';
import { RegistrationStatusPanel } from './components/registration-status-panel';
import { ExtraEUWarningBanner } from './components/extra-eu-warning-banner';
import { CanoneConcordatoCalculator } from './components/canone-concordato-calculator';
import { AttestationGuidancePanel } from './components/attestation-guidance-panel';
import { ImuNotificationExportButton } from './components/imu-notification-export-button';
import { CedolareDecisionPanel } from './components/cedolare-decision-panel';
import { RliChecklist } from './components/rli-checklist';
import { DelegaCaptureDialog } from './components/delega-capture-dialog';
import { getLeaseEventTypeLabel, getLeasePartyRoleLabel, getLeaseTypeAndRegimeLabel } from '@/lib/i18n-labels';
import { ConcordatoAssessmentPanel } from './components/concordato-assessment-panel';

export function LeaseDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lease, isLoading, isError, error, refetch, isFetching } = useLease(id!);
  const { data: checklist } = useRliChecklist(id!);
  const triggerRegistration = useTriggerRegistration();
  const [delegaOpen, setDelegaOpen] = useState(false);

  if (isLoading) {
    return <LoadingScreen message={t('leases.detailLoading')} />;
  }

  const backToList = () => navigate('/app/long-rent/leases');

  // Only a 404 means "not found": a 500, a 403 or a network error is a load error with retry (A7-27).
  if (isError && getHttpStatus(error) !== 404) {
    const reason = getProblemMessage(error, t);
    return (
      <div className="py-12 text-center" role="alert" data-testid="lease-load-error">
        <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
        <h2 className="mb-2 text-2xl font-bold">{t('leases.detailLoadError')}</h2>
        {reason && <p className="text-muted-foreground">{reason}</p>}
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => void refetch()} disabled={isFetching}>
            {t('leases.retry')}
          </Button>
          <Button variant="outline" onClick={backToList}>
            {t('leases.backToList')}
          </Button>
        </div>
      </div>
    );
  }

  if (!lease) {
    return (
      <div className="py-12 text-center" data-testid="lease-not-found">
        <h2 className="mb-2 text-2xl font-bold">{t('leases.notFound')}</h2>
        <p className="text-muted-foreground">
          {t('leases.notFoundDescription')}
        </p>
        <Button className="mt-4" variant="outline" onClick={backToList}>
          {t('leases.backToList')}
        </Button>
      </div>
    );
  }

  const parties = lease.parties ?? [];

  const showExtraEuBanner =
    lease.hasExtraEUTenant ||
    parties.some((party) => party.role === 'Tenant' && party.isExtraEU);

  // The mutations report their own errors (toast with the server's reason): only swallow the rejection.
  const handleSubmitToProvider = () => {
    setDelegaOpen(true);
  };

  const handleDelegaConfirm = async (payload: {
    tosVersion: string;
    attestationAccepted: boolean;
  }) => {
    try {
      await triggerRegistration.mutateAsync({
        id: lease.id,
        tosVersion: payload.tosVersion,
        attestationAccepted: payload.attestationAccepted,
      });
      setDelegaOpen(false);
    } catch {
      // Reported by useTriggerRegistration.onError (the lease is reloaded with the recorded failure).
      setDelegaOpen(false);
    }
  };

  // The provider path exists only when the API says so (flag on and configured provider, LT-01); otherwise manual.
  const providerFilingAvailable = checklist?.providerFilingAvailable === true;

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={backToList} aria-label={t('leases.backToList')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={lease.property?.name ?? t('leases.leaseContract')}
            description={`${formatDate(lease.startDate)} — ${formatDate(lease.endDate)}`}
          />
          <div className="ml-auto">
            <LeaseStatusBadge status={lease.status} className="text-sm px-3 py-1" />
          </div>
        </div>

        {showExtraEuBanner && <ExtraEUWarningBanner />}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{t('leases.contractTerms')}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">{t('leases.monthlyRent')}</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(lease.monthlyRent)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leases.fiscalRegime')}</p>
                  <p className="font-medium" data-testid="lease-type-regime">{getLeaseTypeAndRegimeLabel(lease, t)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leases.securityDeposit')}</p>
                  <p className="font-medium">
                    {lease.securityDeposit != null ? formatCurrency(lease.securityDeposit) : t('leases.securityDepositMissing')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leases.stipulaDate')}</p>
                  <p className="font-medium" data-testid="lease-stipula-date">
                    {lease.stipulaDate ? formatDate(lease.stipulaDate) : t('leases.stipulaDateMissing')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leases.registrationDeadline')}</p>
                  <p className="font-medium" data-testid="lease-registration-deadline">
                    {lease.registrationDeadline
                      ? formatDate(lease.registrationDeadline)
                      : t('leases.registrationDeadlineToBeDetermined')}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">{t('leases.created')}</p>
                  <p className="font-medium">{formatDateTime(lease.createdAt)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('leases.parties')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {parties.length === 0 && (
                  <p className="text-sm text-muted-foreground">{t('leases.noParties')}</p>
                )}
                {parties.map((party) => (
                  <div
                    key={party.id}
                    data-testid="lease-party"
                    className="flex flex-col gap-1 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {party.firstName} {party.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{getLeasePartyRoleLabel(party.role, t)}</p>
                      {/* Masked by the server: the clear fiscal code and email never reach the browser (A7-17). */}
                      <p className="text-sm text-muted-foreground">
                        {t('leases.fiscalCodeMasked')}: {party.fiscalCodeMasked}
                      </p>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">{t('leases.contactEmailMasked')}: </span>
                      {party.contactEmailMasked}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* LT-02: offline signature by default, provider only when the API says it is available. */}
            <LeaseSigningPanel lease={lease} />

            <CedolareDecisionPanel leaseId={lease.id} />
            <RliChecklist leaseId={lease.id} />
            <RegistrationStatusPanel
              leaseId={lease.id}
              leaseStatus={lease.status}
              registration={lease.registration}
              registrationDeadline={lease.registrationDeadline}
              providerFilingAvailable={providerFilingAvailable}
              onSubmitToProvider={handleSubmitToProvider}
              isSubmittingToProvider={triggerRegistration.isPending}
            />
            {providerFilingAvailable && checklist && (
              <DelegaCaptureDialog
                open={delegaOpen}
                onOpenChange={setDelegaOpen}
                tosVersion={checklist.tosVersion}
                attestationText={checklist.attestationText}
                isSubmitting={triggerRegistration.isPending}
                onConfirm={handleDelegaConfirm}
              />
            )}

            {lease.concordatoAssessment ? (
              <ConcordatoAssessmentPanel assessment={lease.concordatoAssessment} />
            ) : (
              <CanoneConcordatoCalculator propertyId={lease.propertyId} startDate={lease.startDate} endDate={lease.endDate} />
            )}
            <AttestationGuidancePanel propertyId={lease.propertyId} />
            <ImuNotificationExportButton leaseId={lease.id} leaseStatus={lease.status} />
          </div>

          <div className="space-y-6">
            {lease.events && lease.events.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t('leases.timeline')}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {lease.events.map((event, index) => (
                    <div key={`${event.eventType}-${index}`} className="border-l-2 pl-3" data-testid="lease-event">
                      <p className="font-medium">{getLeaseEventTypeLabel(event.eventType, t)}</p>
                      <p className="text-muted-foreground">
                        {formatDateTime(event.occurredAt)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </div>
  );
}
