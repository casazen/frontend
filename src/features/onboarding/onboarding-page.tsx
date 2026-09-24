import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { useAuth } from '@/hooks/use-auth';
import { useCompleteOnboarding, useMe } from '@/queries/use-users';
import type { OnboardingResponse, PlanTier, RentalType } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import { ROLES_CLAIM } from '@/lib/auth-roles';
import { useUserRoles } from '@/hooks/use-user-roles';
import {
  canEditOnboarding,
  getHomeRouteForUser,
  getPostOnboardingRoute,
  isExemptFromHostOnboarding,
  isProfileLoadFailure,
  needsOrgSetup,
} from '@/lib/onboarding';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { isDemoMode } from '@/config/demo.config';
import { applyDemoOnboardingProfile } from '@/lib/demo-onboarding';
import { RentalTypeCard } from './components/rental-type-card';
import { ConsentsStep } from './components/consents-step';
import { RolesPendingPanel } from './components/roles-pending-panel';
import { PlanSelectionGrid } from '@/components/org/plan-selection-grid';
import { ProfileLoadError } from '@/components/auth/profile-load-error';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';

const RENTAL_TYPES: RentalType[] = ['ShortTerm', 'LongTerm', 'Both'];

/** 422 code of `PUT /users/onboarding` from a user without org and without consents (backend A1-01). */
const CONSENTS_REQUIRED_CODE = 'consents_required';

type WizardStep = 'role' | 'consents' | 'plan';

interface PendingRoles {
  rentalType: RentalType;
  planTier: PlanTier;
  target: string;
}

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';
  const from = (location.state as { from?: string } | null)?.from ?? null;
  const { refreshAccessToken, forceReauth } = useAuth();
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
    isFetching: profileFetching,
  } = useMe();
  const completeOnboarding = useCompleteOnboarding();
  const [step, setStep] = useState<WizardStep>('role');
  const [selectedType, setSelectedType] = useState<RentalType | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanTier>('Starter');
  const [consents, setConsents] = useState<OnboardingConsentsPayload | null>(null);
  const [failedType, setFailedType] = useState<RentalType | null>(null);
  const [consentsForced, setConsentsForced] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<PendingRoles | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const roles = useUserRoles();
  const hasRoles = roles.length > 0;
  const hasOrg = !needsOrgSetup(profile);
  const isOrgBackfill = hasRoles && !hasOrg;
  // A1-01: PUT (no consents) only when the backend already has a completed onboarding with an org. Any other case,
  // with JWT roles or not, creates the first org: consents step and POST.
  const isUpdate = canEditOnboarding(profile) && !consentsForced;
  const needsConsentsStep = !isUpdate;
  // Admins and supplier-only users do not need a host org: they may leave the wizard.
  const canSkip = !hasOrg && !isEditMode && isExemptFromHostOnboarding(roles);

  useEffect(() => {
    if (profileLoading || !profile || pendingRoles || isLeaving) return;

    if (isEditMode && !canEditOnboarding(profile)) {
      navigate('/', { replace: true });
      return;
    }

    if (!isEditMode && hasOrg && hasRoles) {
      navigate(getHomeRouteForUser({ [ROLES_CLAIM]: roles }), { replace: true });
      return;
    }

    if (profile.rentalType) {
      // Wizard state is re-synced from the server profile in the same pass that decides the
      // redirect, on every change of these inputs; an in-progress selection is kept.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedType((current) => current ?? profile.rentalType ?? null);
    }

    if (isEditMode && profile.rentalType) {
      setStep('plan');
    }
  }, [navigate, profile, profileLoading, hasOrg, hasRoles, isEditMode, roles, pendingRoles, isLeaving]);

  const leaveTo = async (target: string) => {
    setIsLeaving(true);
    try {
      // New roles reach the access token only through a fresh token.
      await refreshAccessToken();
    } catch {
      // No silent renewal: the next page load renews the token or asks to sign in again.
    }
    window.location.assign(target);
  };

  const finishOnboarding = async (rentalType: RentalType, planTier: PlanTier) => {
    setSelectedType(rentalType);
    setFailedType(null);

    if (isDemoMode) {
      applyDemoOnboardingProfile(rentalType);
      setIsLeaving(true);
      window.location.assign(getPostOnboardingRoute(rentalType, from));
      return;
    }

    if (needsConsentsStep && !consents) {
      toast.error(t('onboarding.consentRequiredToast'));
      setStep('consents');
      return;
    }

    let result: OnboardingResponse;
    try {
      result = await completeOnboarding.mutateAsync({
        rentalType,
        planTier,
        isUpdate,
        consents: needsConsentsStep ? consents ?? undefined : undefined,
      });
    } catch (error) {
      if (isAxiosError(error) && getProblemCode(error.response?.data) === CONSENTS_REQUIRED_CODE) {
        // The profile was stale: the backend has no org for this user yet, which needs the consents first.
        setConsentsForced(true);
        setStep('consents');
        toast.error(t('onboarding.consentRequiredToast'));
        return;
      }
      setFailedType(rentalType);
      toast.error(getProblemMessage(error, t) ?? t('onboarding.configurationErrorToast'));
      return;
    }

    const target = getPostOnboardingRoute(rentalType, from);
    if (result.rolesSynced === false) {
      if (pendingRoles) toast.error(t('onboarding.rolesPending.stillPending'));
      setPendingRoles({ rentalType, planTier, target });
      return;
    }

    setPendingRoles(null);
    await leaveTo(target);
  };

  const renewSessionAndContinue = async (target: string) => {
    setIsRenewing(true);
    try {
      await refreshAccessToken();
    } catch {
      // Silent renewal refused (e.g. login_required): a new sign-in issues a token with the current roles.
      forceReauth();
      return;
    }
    setIsLeaving(true);
    window.location.assign(target);
  };

  const handleRentalSelect = (rentalType: RentalType) => {
    setSelectedType(rentalType);
    setStep(needsConsentsStep ? 'consents' : 'plan');
  };

  const handlePlanConfirm = () => {
    if (!selectedType) return;
    void finishOnboarding(selectedType, selectedPlan);
  };

  if (profileLoading || isLeaving) {
    return <LoadingScreen message={t('shared.loading.defaultMessage')} />;
  }

  // A1-19: a failed profile load is not "not onboarded": retry instead of a wizard that could change the roles.
  if (!profile && isProfileLoadFailure(profileError)) {
    return (
      <ProfileLoadError error={profileError} onRetry={() => void refetchProfile()} isRetrying={profileFetching} />
    );
  }

  if (pendingRoles) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/40 px-4 py-12">
        <RolesPendingPanel
          isRetrying={completeOnboarding.isPending}
          isRenewing={isRenewing}
          onRetry={() => void finishOnboarding(pendingRoles.rentalType, pendingRoles.planTier)}
          onRenewSession={() => void renewSessionAndContinue(pendingRoles.target)}
        />
      </div>
    );
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

        {step === 'role' && canSkip ? (
          <div className="space-y-2" data-testid="onboarding-skip">
            <p className="text-sm text-muted-foreground">{t('onboarding.skipDescription')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(getHomeRouteForUser({ [ROLES_CLAIM]: roles }), { replace: true })}
            >
              {t('onboarding.skipForNow')}
            </Button>
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
              <Button
                type="button"
                variant="outline"
                disabled={completeOnboarding.isPending}
                onClick={() => setStep(needsConsentsStep ? 'consents' : 'role')}
              >
                {t('onboarding.back')}
              </Button>
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

        {failedType && !completeOnboarding.isPending ? (
          <button
            type="button"
            data-testid="onboarding-retry"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => void finishOnboarding(failedType, selectedPlan)}
          >
            {t('onboarding.retry')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
