import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
        toast.error(t('onboarding.consentRequiredToast'));
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
      toast.error(t('onboarding.configurationErrorToast'));
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
    return <LoadingScreen message={t('shared.loading.defaultMessage')} />;
  }

  const heading =
    step === 'role'
      ? isEditMode
        ? t('onboarding.editOperatorType')
        : t('onboarding.howToUse')
      : step === 'consents'
        ? t('onboarding.acceptLegalDocs')
        : t('onboarding.choosePlan');

  const subheading =
    step === 'role'
      ? t('onboarding.roleDescription')
      : step === 'consents'
        ? t('onboarding.consentsDescription')
        : isOrgBackfill
          ? t('onboarding.planOrgDescription')
          : t('onboarding.planDefaultDescription');

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-12">
      <div className="mx-auto max-w-5xl space-y-10 text-center">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('onboarding.casaZen')}</p>
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
              actionLabel={t('onboarding.select')}
            />
            <div className="flex flex-wrap items-center justify-center gap-3">
              {!isOrgBackfill && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={completeOnboarding.isPending}
                  onClick={() => setStep(needsConsentsStep ? 'consents' : 'role')}
                >
                  {t('onboarding.back')}
                </Button>
              )}
              <Button
                type="button"
                data-testid="onboarding-plan-confirm"
                disabled={completeOnboarding.isPending || !selectedType}
                onClick={handlePlanConfirm}
              >
                {completeOnboarding.isPending
                  ? t('onboarding.configuring')
                  : isEditMode
                    ? t('onboarding.saveChanges')
                    : t('onboarding.completeRegistration')}
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
            {t('onboarding.retry')}
          </button>
        )}
      </div>
    </div>
  );
}
