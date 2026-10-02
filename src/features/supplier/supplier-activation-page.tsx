import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import {
  useCompleteSupplierActivation,
  useSaveSupplierActivationStep,
  useSupplierActivation,
  useSupplierProfile,
} from '@/queries/use-supplier';
import { ACTIVATION_STEP_IDS, type ActivationStatus, type SupplierProfile } from '@/types/supplier';
import { ActivationTermsCard } from './components/activation-terms-card';
import {
  CalendarFeedCard,
  IdentityStep,
  ProfileStep,
  ServicesStep,
  ShowcaseStep,
} from './components/activation-steps';
import { TosReacceptance } from './components/tos-reacceptance';

const STEP_COUNT = ACTIVATION_STEP_IDS.length;
const TERMS_STEP = STEP_COUNT;

function clampStep(step: number): number {
  return Math.min(Math.max(Math.trunc(step) || 1, 1), STEP_COUNT);
}

/** Step 5: optional calendar, Terms of Service and the check of what is still missing before activating. */
function TermsStep({ activation, onGoToStep }: { activation: ActivationStatus; onGoToStep: (step: number) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const complete = useCompleteSupplierActivation();
  const [tosAccepted, setTosAccepted] = useState(false);

  // What the server still finds missing in the stored profile (everything but the Terms, which are the checkbox below).
  const missing = activation.steps
    .map((step, index) => ({ step, number: index + 1 }))
    .filter(({ step }) => step.required && step.blocker && step.id !== 'terms');

  const handleActivate = async () => {
    try {
      await complete.mutateAsync({ tosAccepted, tosVersion: activation.tos.currentVersion });
      toast.success(t('supplier.activation.activated'));
      navigate('/app/supplier/dashboard', { replace: true });
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('supplier.activation.activateError'));
    }
  };

  return (
    <div className="space-y-6">
      <CalendarFeedCard />
      <ActivationTermsCard
        version={activation.tos.currentVersion}
        checked={tosAccepted}
        onCheckedChange={setTosAccepted}
        disabled={complete.isPending}
      />

      <Card data-testid="supplier-activation-summary">
        <CardContent className="space-y-3 pt-6">
          <h3 className="text-sm font-semibold">{t('supplier.activation.summary.title')}</h3>
          {missing.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('supplier.activation.summary.ready')}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{t('supplier.activation.summary.missing')}</p>
              <ul className="space-y-1">
                {missing.map(({ step, number }) => (
                  <li key={step.id} className="flex items-center justify-between gap-3 text-sm">
                    <span data-testid={`supplier-activation-blocker-${step.blocker}`}>
                      {t(`supplier.activation.blockers.${step.blocker}`)}
                    </span>
                    <Button type="button" variant="link" size="sm" onClick={() => onGoToStep(number)}>
                      {t('supplier.activation.summary.goTo', { step: number })}
                    </Button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Button
        onClick={() => void handleActivate()}
        disabled={complete.isPending || !tosAccepted || missing.length > 0}
        className="w-full"
      >
        {complete.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
        {complete.isPending ? t('supplier.activation.activating') : t('supplier.activation.activate')}
      </Button>
    </div>
  );
}

function StepNav({
  activation,
  current,
  onGoToStep,
}: {
  activation: ActivationStatus;
  current: number;
  onGoToStep: (step: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('supplier.activation.stepsLabel')}>
      <ol className="grid grid-cols-5 gap-1 text-center">
        {activation.steps.map((step, index) => {
          const number = index + 1;
          const done = step.status === 'completed';
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onGoToStep(number)}
                aria-current={number === current ? 'step' : undefined}
                data-testid={`supplier-activation-nav-${step.id}`}
                className={cn(
                  'flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-xs',
                  number === current ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{t(`supplier.activation.steps.${step.id}`)}</span>
                <span className="sr-only">
                  {done ? t('supplier.activation.stepDone') : t('supplier.activation.stepTodo')}
                </span>
                {!step.required && <span className="text-[10px]">{t('supplier.activation.optional')}</span>}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ActivationWizard({ activation, profile }: { activation: ActivationStatus; profile: SupplierProfile }) {
  const { t } = useTranslation();
  const saveStep = useSaveSupplierActivationStep();
  // The server remembers the step: the wizard opens where the supplier stopped, from any device (SU-05).
  const [step, setStep] = useState(() => clampStep(activation.currentStep));

  const goToStep = (next: number) => {
    const target = clampStep(next);
    setStep(target);
    saveStep.mutate(target, {
      onError: () => toast.error(t('supplier.activation.stepSaveError')),
    });
  };

  return (
    <div className="mx-auto max-w-lg space-y-6" data-testid="supplier-activation-page">
      <PageHeader title={t('supplier.activation.title')} description={t('supplier.activation.description')} />
      <StepNav activation={activation} current={step} onGoToStep={goToStep} />
      <p className="text-sm text-muted-foreground" data-testid="supplier-activation-step-of">
        {t('supplier.activation.stepOf', { current: step, total: STEP_COUNT })}
      </p>

      {/* `key`: each step starts from the data saved on the server, not from the previous step's form. */}
      {step === 1 && <IdentityStep key="identity" profile={profile} onSaved={() => goToStep(2)} />}
      {step === 2 && <ServicesStep key="services" profile={profile} onSaved={() => goToStep(3)} />}
      {step === 3 && <ShowcaseStep key="showcase" profile={profile} onSaved={() => goToStep(4)} />}
      {step === 4 && <ProfileStep key="profile" profile={profile} onSaved={() => goToStep(5)} />}
      {step === TERMS_STEP && <TermsStep activation={activation} onGoToStep={goToStep} />}

      {step > 1 && (
        <Button type="button" variant="ghost" onClick={() => goToStep(step - 1)}>
          {t('supplier.activation.back')}
        </Button>
      )}
    </div>
  );
}

export function SupplierActivationPage() {
  const { t } = useTranslation();
  const activationQuery = useSupplierActivation();
  const profileQuery = useSupplierProfile();

  // An API error is not "loading forever" (A4-25): say it failed and offer a retry.
  if (activationQuery.isError || profileQuery.isError) {
    return (
      <div className="mx-auto max-w-lg">
        <ErrorState
          testId="supplier-activation-error"
          title={t('supplier.activation.loadError')}
          error={activationQuery.error ?? profileQuery.error}
          onRetry={() => {
            void activationQuery.refetch();
            void profileQuery.refetch();
          }}
        />
      </div>
    );
  }

  const activation = activationQuery.data;
  const profile = profileQuery.data;
  if (!activation || !profile) {
    return <LoadingScreen message={t('supplier.activationLoading')} />;
  }

  if (activation.status === 'Suspended') {
    // A suspended supplier cannot activate itself: only an admin reactivates it (SU-12).
    return (
      <div className="mx-auto max-w-lg space-y-4" data-testid="supplier-activation-suspended">
        <PageHeader title={t('supplier.statusSuspended')} description={t('supplier.suspendedHint')} />
      </div>
    );
  }

  if (activation.status === 'Active') {
    // An active supplier whose Terms are not the current version accepts the new one here; otherwise the dashboard.
    return activation.tos.reacceptanceRequired ? (
      <TosReacceptance tos={activation.tos} />
    ) : (
      <Navigate to="/app/supplier/dashboard" replace />
    );
  }

  return <ActivationWizard activation={activation} profile={profile} />;
}
