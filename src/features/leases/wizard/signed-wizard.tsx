import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { getHttpStatus } from '@/lib/api-errors';
import { isBeforeFullSignature } from '@/lib/lease-signing';
import { useLongRentRules } from '@/queries/use-lease-draft';
import { useLease } from '@/queries/use-leases';
import { AfterSignatureStep } from './after-signature-step';
import { LeaseDone } from './lease-done';
import { LeaseWizardFrame, WIZARD_BUTTON } from './lease-wizard-frame';
import { LeaseWizardStepper } from './lease-wizard-stepper';
import { stepWords } from './step-words';
import { AFTER_STEP, DONE_STEP, leaseEditPath, registeredSteps, stepKey } from './wizard-model';

const LEASES_PATH = '/app/long-rent/leases';

/**
 * The end of «Crea contratto» (LR-06b), once the contract is signed: «Dopo la firma» (`?step=8`) and the final screen «Cosa succede ora»
 * (`?step=done`). A signed lease is not a draft any more, so these two read the lease and not the draft (`GET /leases/:id`); a lease that
 * is still a draft has no business here and goes back to the wizard of its draft. What the declaration of the registration needs is
 * the existing window, opened at once when the contract was brought in as already registered.
 */
export function SignedWizard({ leaseId, view }: { leaseId: string; view: 'after' | 'done' }) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const lease = useLease(leaseId);
  const rules = useLongRentRules();

  // The final screen counts the notice from the months the server states: it waits for them, so its rows do not change under the eyes.
  if (lease.isLoading || (view === 'done' && rules.isLoading)) {
    return <LoadingScreen message={t('leases.detailLoading')} className="h-auto flex-1" />;
  }

  if (lease.isError || !lease.data) {
    if (getHttpStatus(lease.error) === 404) {
      return (
        <div data-testid="lease-not-found">
          <EmptyState icon={FileText} title={t('leases.notFound')} description={t('leases.notFoundDescription')} action={{ label: t('leases.backToList'), href: LEASES_PATH }} />
        </div>
      );
    }
    return <ErrorState testId="lease-load-error" title={t('leases.detailLoadError')} error={lease.error} onRetry={() => void lease.refetch()} />;
  }

  const data = lease.data;
  // Not signed yet: the wizard of the draft is where it goes on.
  if (isBeforeFullSignature(data.status)) return <Navigate to={leaseEditPath(leaseId)} replace />;

  if (view === 'done') return <LeaseDone lease={data} rules={rules.data} />;

  const origin = data.origin ?? 'Created';
  const declareFirst = (location.state as { declareRegistration?: boolean } | null)?.declareRegistration === true;
  const steps = registeredSteps(origin);
  const entries = steps.map((step) => ({
    step,
    label: t(`leaseWizard.steps.${stepKey(step, origin)}.label`),
    mark: step === AFTER_STEP ? ('current' as const) : ('done' as const),
  }));
  const words = stepWords(t, i18n, AFTER_STEP, origin);

  return (
    <LeaseWizardFrame
      stepper={<LeaseWizardStepper entries={entries} current={AFTER_STEP} />}
      position={{ current: steps.indexOf(AFTER_STEP) + 1, total: steps.length }}
      title={words.title}
      summary={words.summary}
      inHand={words.inHand}
      footer={
        <div className="flex justify-end">
          <Button asChild className={`${WIZARD_BUTTON} w-full sm:w-auto`}>
            <Link to={leaseEditPath(leaseId, DONE_STEP)} data-testid="lease-after-finish">
              {t('leaseWizardGuide.next.finish')}
            </Link>
          </Button>
        </div>
      }
    >
      <AfterSignatureStep lease={data} declareFirst={declareFirst} />
    </LeaseWizardFrame>
  );
}
