import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { useCompleteOnboarding, useMe } from '@/queries/use-users';
import type { PlanTier, RentalType } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import { ROLES_CLAIM } from '@/lib/auth-roles';
import { useUserRoles } from '@/hooks/use-user-roles';
import { getHomeRouteForRentalType, getHomeRouteForUser, needsOrgSetup, canEditOnboarding } from '@/lib/onboarding';
import { isDemoMode } from '@/config/demo.config';
import { applyDemoOnboardingProfile } from '@/lib/demo-onboarding';
import { RentalTypeCard } from './components/rental-type-card';
import { ConsentsStep } from './components/consents-step';
import { PlanSelectionGrid } from '@/components/org/plan-selection-grid';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';

const RENTAL_TYPES: RentalType[] = ['ShortTerm', 'LongTerm', 'Both'];

type WizardStep = 'role' | 'consents' | 'plan';

export function OnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';
  const { user, refreshAccessToken } = useAuth();
  const { data: profile, isLoading: profileLoading } = useMe();
  const completeOnboarding = useCompleteOnboarding();
  const [step, setStep] = useState<WizardStep>('role');
  const [selectedType, setSelectedType] = useState<RentalType | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('Starter');
  const [consents, setConsents] = useState<OnboardingConsentsPayload | null>(null);
  const [failedType, setFailedType] = useState<RentalType | null>(null);

  const roles = useUserRoles();
  const hasRoles = roles.length > 0;
  const isOrgBackfill = hasRoles && needsOrgSetup(profile);
  const needsConsentsStep = !hasRoles && !isEditMode;

  useEffect(() => {
    if (profileLoading || !profile) return;

    if (profile.rentalType) {
      setSelectedType(profile.rentalType);
    }

    if (isOrgBackfill && profile.rentalType) {
      setStep('plan');
    }

    if (isEditMode && profile.rentalType) {
      setStep('plan');
    }

    if (isEditMode && !canEditOnboarding(profile)) {
      navigate('/', { replace: true });
      return;
    }

    if (!needsOrgSetup(profile) && hasRoles && !isEditMode) {
      navigate(getHomeRouteForUser({ [ROLES_CLAIM]: roles }), { replace: true });
    }
  }, [navigate, user, profile, profileLoading, hasRoles, isOrgBackfill, isEditMode, roles]);

  const finishOnboarding = async (rentalType: RentalType, planTier: PlanTier) => {
    setSelectedType(rentalType);
    setFailedType(null);

    try {
      if (isDemoMode) {
        applyDemoOnboardingProfile(rentalType);
        window.location.assign(getHomeRouteForRentalType(rentalType));
        return;
      }

      if (needsConsentsStep && !consents) {
        toast.error('Accetta i documenti legali obbligatori prima di continuare.');
        setStep('consents');
        return;
      }

      await completeOnboarding.mutateAsync({
        rentalType,
        planTier,
        isUpdate: hasRoles,
        consents: needsConsentsStep ? consents ?? undefined : undefined,
      });
      await refreshAccessToken();
      window.location.assign(getHomeRouteForRentalType(rentalType));
    } catch {
      setFailedType(rentalType);
      toast.error('Errore durante la configurazione del profilo. Riprova.');
      setSelectedType(null);
    }
  };

  const handleRentalSelect = (rentalType: RentalType) => {
    setSelectedType(rentalType);
    setStep(needsConsentsStep ? 'consents' : 'plan');
  };

  const handlePlanConfirm = () => {
    if (!selectedType) return;
    void finishOnboarding(selectedType, selectedPlan);
  };

  if (profileLoading) {
    return <LoadingScreen message="Caricamento..." />;
  }

  const heading =
    step === 'role'
      ? isEditMode
        ? 'Modifica tipo di operatore'
        : 'Come vuoi usare CasaZen?'
      : step === 'consents'
        ? 'Accetta i documenti legali'
        : 'Scegli il tuo piano';

  const subheading =
    step === 'role'
      ? 'Scegli il tipo di operatore per personalizzare la tua esperienza.'
      : step === 'consents'
        ? 'Per attivare il tuo account sono richiesti ToS, privacy, DPA e l\'elenco subprocessori.'
        : isOrgBackfill
          ? 'Configura la tua organizzazione per iniziare a gestire proprietà e prenotazioni.'
          : 'Seleziona il piano iniziale per la tua organizzazione. Potrai modificarlo in seguito.';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-10 text-center">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">CasaZen</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{heading}</h1>
          <p className="text-muted-foreground">{subheading}</p>
        </div>

        {step === 'role' ? (
          <div className="grid gap-6 text-left md:grid-cols-3">
            {RENTAL_TYPES.map((rentalType) => (
              <RentalTypeCard
                key={rentalType}
                rentalType={rentalType}
                onSelect={handleRentalSelect}
                isLoading={completeOnboarding.isPending}
                selectedType={selectedType}
              />
            ))}
          </div>
        ) : null}

        {step === 'consents' ? (
          <ConsentsStep
            onBack={() => setStep('role')}
            onContinue={(payload) => {
              setConsents(payload);
              setStep('plan');
            }}
            isLoading={completeOnboarding.isPending}
          />
        ) : null}

        {step === 'plan' ? (
          <div className="space-y-6">
            <PlanSelectionGrid
              selectedTier={selectedPlan}
              onSelect={setSelectedPlan}
              isLoading={completeOnboarding.isPending}
              actionLabel="Seleziona"
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isOrgBackfill && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={completeOnboarding.isPending}
                  onClick={() => setStep(needsConsentsStep ? 'consents' : 'role')}
                >
                  Indietro
                </Button>
              )}
              <Button
                type="button"
                data-testid="onboarding-plan-confirm"
                disabled={completeOnboarding.isPending || !selectedType}
                onClick={handlePlanConfirm}
              >
                {completeOnboarding.isPending
                  ? 'Configurazione...'
                  : isEditMode
                    ? 'Salva modifiche'
                    : 'Completa registrazione'}
              </Button>
            </div>
          </div>
        ) : null}

        {failedType && step === 'role' && (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => void finishOnboarding(failedType, selectedPlan)}
          >
            Riprova
          </button>
        )}
      </div>
    </div>
  );
}
