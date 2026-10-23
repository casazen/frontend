import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getProblemMessage } from '@/lib/api-errors';
import { cn } from '@/lib/utils';
import { useCompleteSupplierActivation, useSaveSupplierActivationStep, useSupplierActivation, useSupplierProfile } from '@/queries/supplier/use-profile';
import type { ActivationStatus, ActivationStepId, SupplierProfile } from '@/types/supplier';
import { ActivationTermsCard } from './components/activation-terms-card';
import { IdentityStep, PresentationStep, ServicesStep } from './components/activation-steps';
import { TosReacceptance } from './components/tos-reacceptance';

/**
 * What the supplier sees: at most four screens, from the five steps the server tracks (SU-05). The identity (business name,
 * phone) is asked at registration, so its screen only appears when the server still finds it incomplete; the optional
 * showcase photos live with the description; the optional calendar is offered after the activation, from the dashboard.
 * The server keeps the step number, so the wizard still resumes where the supplier stopped, on any device.
 */
type ScreenId = 'identity' | 'services' | 'profile' | 'terms';

interface Screen {
  id: ScreenId;
  /** Step number the server remembers while the screen is open (1-5). */
  serverStep: number;
  /** Server steps whose requirements the screen collects. */
  stepIds: ActivationStepId[];
}

const ALL_SCREENS: Screen[] = [
  { id: 'identity', serverStep: 1, stepIds: ['identity'] },
  { id: 'services', serverStep: 2, stepIds: ['services'] },
  { id: 'profile', serverStep: 3, stepIds: ['showcase', 'profile'] },
  { id: 'terms', serverStep: 5, stepIds: ['terms'] },
];

/** Screen that collects a server step (1-5). */
function screenIdForServerStep(step: number): ScreenId {
  if (step <= 1) return 'identity';
  if (step === 2) return 'services';
  if (step <= 4) return 'profile';
  return 'terms';
}

function visibleScreens(activation: ActivationStatus): Screen[] {
  const identityDone = activation.steps.find((step) => step.id === 'identity')?.status === 'completed';
  return ALL_SCREENS.filter((screen) => screen.id !== 'identity' || !identityDone);
}

function isScreenDone(activation: ActivationStatus, screen: Screen): boolean {
  return activation.steps
    .filter((step) => screen.stepIds.includes(step.id) && step.required)
    .every((step) => step.status === 'completed');
}

/** Last screen: Terms of Service and the check of what is still missing before activating. */
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
  screens,
  current,
  onGoToScreen,
}: {
  activation: ActivationStatus;
  screens: Screen[];
  current: number;
  onGoToScreen: (index: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('supplier.activation.stepsLabel')}>
      <ol className="grid gap-1 text-center" style={{ gridTemplateColumns: `repeat(${screens.length}, minmax(0, 1fr))` }}>
        {screens.map((screen, index) => {
          const done = isScreenDone(activation, screen);
          return (
            <li key={screen.id}>
              <button
                type="button"
                onClick={() => onGoToScreen(index)}
                aria-current={index === current ? 'step' : undefined}
                data-testid={`supplier-activation-nav-${screen.id}`}
                className={cn(
                  'flex w-full flex-col items-center gap-1 rounded-md px-1 py-2 text-xs',
                  index === current ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60',
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />
                ) : (
                  <Circle className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{t(`supplier.activation.steps.${screen.id}`)}</span>
                <span className="sr-only">
                  {done ? t('supplier.activation.stepDone') : t('supplier.activation.stepTodo')}
                </span>
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
  // Fixed for the visit: a screen never disappears under the supplier's hands when its data is saved.
  const [screens] = useState(() => visibleScreens(activation));
  const [index, setIndex] = useState(() => {
    const resumed = screens.findIndex((screen) => screen.id === screenIdForServerStep(activation.currentStep));
    return resumed >= 0 ? resumed : 0;
  });

  const goToScreen = (next: number) => {
    const target = Math.min(Math.max(next, 0), screens.length - 1);
    setIndex(target);
    saveStep.mutate(screens[target].serverStep, {
      onError: () => toast.error(t('supplier.activation.stepSaveError')),
    });
  };
  const goToServerStep = (step: number) => {
    const target = screens.findIndex((screen) => screen.id === screenIdForServerStep(step));
    goToScreen(target >= 0 ? target : 0);
  };

  const current = screens[index];
  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="supplier-activation-page">
      <PageHeader title={t('supplier.activation.title')} description={t('supplier.activation.description')} />
      <StepNav activation={activation} screens={screens} current={index} onGoToScreen={goToScreen} />
      <p className="text-sm text-muted-foreground" data-testid="supplier-activation-step-of">
        {t('supplier.activation.stepOf', { current: index + 1, total: screens.length })}
      </p>

      {/* `key`: each step starts from the data saved on the server, not from the previous step's form. */}
      {current.id === 'identity' && <IdentityStep key="identity" profile={profile} onSaved={() => goToScreen(index + 1)} />}
      {current.id === 'services' && <ServicesStep key="services" profile={profile} onSaved={() => goToScreen(index + 1)} />}
      {current.id === 'profile' && <PresentationStep key="profile" profile={profile} onSaved={() => goToScreen(index + 1)} />}
      {current.id === 'terms' && <TermsStep activation={activation} onGoToStep={goToServerStep} />}

      {index > 0 && (
        <Button type="button" variant="ghost" onClick={() => goToScreen(index - 1)}>
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
    return <LoadingScreen message={t('supplier.activationLoading')} className="h-auto flex-1" />;
  }

  if (activation.status === 'Suspended') {
    // A suspended supplier cannot activate itself: only an admin reactivates it (SU-12).
    return (
      <div className={cn(FOCUS_COLUMN, 'space-y-4')} data-testid="supplier-activation-suspended">
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
