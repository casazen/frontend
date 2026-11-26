import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { confirmWorkspaceAccess } from './confirm-workspace-access';
import { CommercialSignupWizard } from './commercial-signup-wizard';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import { useAuth } from '@/hooks/use-auth';
import { useCompleteOnboarding, useMe } from '@/queries/use-users';
import type { OnboardingResponse, RentalType, UserDetail } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import { ROLES_CLAIM } from '@/lib/auth-roles';
import { useUserRoles, useUserRoleState } from '@/hooks/use-user-roles';
import {
  canEditOnboarding,
  getHomeRouteForRentalType,
  getHomeRouteForUser,
  getPostOnboardingRoute,
  getProfilePageForRentalType,
  getRentalTypeOfHostSetUpByServer,
  getStaleConsentDocuments,
  isExemptFromHostOnboarding,
  isLinkedSupplier,
  isProfileLoadFailure,
  lacksCurrentConsents,
  needsConsentRenewal,
  needsOrgSetup,
  SUPPLIER_HOME_ROUTE,
} from '@/lib/onboarding';
import { SUPPLIER_CLAIM_PATH } from '@/lib/supplier-claim';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { isDemoMode } from '@/config/demo.config';
import { applyDemoOnboardingProfile } from '@/lib/demo-onboarding';
import { useReloadLegalDocuments } from '@/queries/use-legal';
import { markSignupAttributionReady, syncSignupAttribution } from '@/lib/signup-attribution';
import { RentalTypeCard } from './components/rental-type-card';
import { ConsentsStep } from './components/consents-step';
import { WorkspaceAccessError } from './components/workspace-access-error';
import { SupplierEntryLink } from './components/supplier-entry-link';
import { ProfileLoadError } from '@/components/auth/profile-load-error';
import { Button } from '@/components/ui/button';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

const RENTAL_TYPES: RentalType[] = ['ShortTerm', 'LongTerm', 'Both'];

const WIZARD_STEPS: WizardStep[] = ['role', 'consents'];

/** 422 code of `PUT /users/onboarding` from a user without org and without consents (backend A1-01). */
const CONSENTS_REQUIRED_CODE = 'consents_required';

/** Two screens at most: the rental type, then the legal consents. The plan is never asked here: the org starts on Starter. */
type WizardStep = 'role' | 'consents';

interface PendingAccess {
  rentalType: RentalType;
  target: string;
}

export function OnboardingPage() {
  const { data: profile, isLoading, error } = useMe();
  if (isLoading) return <LoadingScreen />;
  if (!profile && error && isProfileLoadFailure(error)) return <ExistingOnboardingPage />;
  return <OnboardingRoute key={JSON.stringify([profile?.id, profile?.orgId])} profile={profile} />;
}

function OnboardingRoute({ profile }: { profile: UserDetail | undefined }) {
  const [params] = useSearchParams();
  const roles = useUserRoles();
  // A profile refetch may observe a settled payment before the workspace check finishes. Keep this visit on its confirmation screen.
  const [startedInPayment] = useState(profile?.commercialSetupRequired === true);
  // Back from Stripe (`?checkout=success`) after the webhook already cleared `commercialSetupRequired`: still open the commercial
  // wizard so «Entra e inizia la configurazione» is shown — not the legacy rental-type choice (GJ L3 / commercial-signup.ts).
  const returningFromCheckout =
    params.get('checkout') === 'success' && !!profile?.commercialSignup && !needsConsentRenewal(profile);
  const commercial =
    profile?.commercialSetupRequired === true ||
    returningFromCheckout ||
    (startedInPayment && !!profile?.commercialSignup && !needsConsentRenewal(profile));
  const legacy = params.get('mode') === 'edit' || (!commercial &&
    (isExemptFromHostOnboarding(roles) || isLinkedSupplier(profile) || !!profile?.orgId));
  if (legacy) return <ExistingOnboardingPage />;
  return <CommercialSignupWizard profile={profile} />;
}

export function ExistingOnboardingPage() {
  const { flags } = useFeatureFlags();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isEditMode = searchParams.get('mode') === 'edit';
  const locationState = location.state as { from?: string; completeStep?: boolean } | null;
  const from = locationState?.from ?? null;
  // The activation checklist sent the user here to finish a step it still shows as "todo": stay, never bounce to the home.
  const completingChecklistStep = locationState?.completeStep === true;
  const { refreshAccessToken } = useAuth();
  const client = useQueryClient();
  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
    isFetching: profileFetching,
  } = useMe();
  const completeOnboarding = useCompleteOnboarding();
  const reloadLegalDocuments = useReloadLegalDocuments();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState<WizardStep>('role');
  const [selectedType, setSelectedType] = useState<RentalType | null>(null);
  const [consents, setConsents] = useState<OnboardingConsentsPayload | null>(null);
  // Remounts the consents step (checkboxes cleared) when the accepted versions turned out to be outdated (A1-39).
  const [consentsAttempt, setConsentsAttempt] = useState(0);
  const [failedType, setFailedType] = useState<RentalType | null>(null);
  const [consentsForced, setConsentsForced] = useState(false);
  const [pendingAccess, setPendingAccess] = useState<PendingAccess | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step, consentsAttempt, profileLoading, isLeaving]);

  const { roles, isResolved: rolesResolved } = useUserRoleState();
  const hasRoles = roles.length > 0;
  const hasOrg = !needsOrgSetup(profile);
  // Linked in the database (invite, registration, claim) even when the Supplier role is not in the token yet.
  const linkedSupplier = isLinkedSupplier(profile);
  const homeRoute = getHomeRouteForUser({ [ROLES_CLAIM]: roles }, profile);
  // A host the server has set up owns its workspace through the persisted memberships even while the access token has no role claims
  // (issued before the memberships existed, or the roles could not be synced): back from the payment the claims must not keep it on
  // this wizard. Its area is the one of its rental type, which the claims of the token cannot say.
  const setUpHostRentalType = !hasRoles && rolesResolved ? getRentalTypeOfHostSetUpByServer(profile) : null;
  // Where a user who has finished the onboarding belongs; `null` while nothing says it.
  const finishedRoute = hasRoles || linkedSupplier ? homeRoute : setUpHostRentalType ? getHomeRouteForRentalType(setUpHostRentalType) : null;
  // PL-02: the backend withholds the host features until the onboarding and the current consents.
  const hostAccessWithheld = profile?.onboardingRequired === true;
  // A completed onboarding whose legal documents changed: only the consents step, then the same rental type.
  const renewsConsents = needsConsentRenewal(profile) && !isEditMode;
  // A1-01: PUT (no consents) only when the backend already has a completed onboarding with an org and current consents.
  // Any other case, with JWT roles or not, goes through the consents step and the POST.
  const isUpdate = canEditOnboarding(profile) && !consentsForced && !lacksCurrentConsents(profile);
  const needsConsentsStep = !isUpdate;
  // Admins and supplier-only users do not need a host org: they may leave the wizard.
  const canSkip = !isEditMode && isExemptFromHostOnboarding(roles) && (!hasOrg || hostAccessWithheld);

  useEffect(() => {
    if (profileLoading || !profile || pendingAccess || isLeaving) return;

    if (isEditMode && !canEditOnboarding(profile)) {
      navigate('/', { replace: true });
      return;
    }

    // A linked supplier belongs to the supplier console, never to the host wizard (A4-02). A host whose host features
    // are withheld by the backend (PL-02) stays here: its home would answer onboarding_required again.
    if (
      !isEditMode &&
      !completingChecklistStep &&
      hasOrg &&
      finishedRoute &&
      (!hostAccessWithheld || homeRoute === SUPPLIER_HOME_ROUTE)
    ) {
      navigate(finishedRoute, { replace: true });
      return;
    }

    if (profile.rentalType) {
      // Wizard state is re-synced from the server profile in the same pass that decides the
      // redirect, on every change of these inputs; an in-progress selection is kept.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedType((current) => current ?? profile.rentalType ?? null);
    }

    if (renewsConsents) {
      setStep((current) => (current === 'role' ? 'consents' : current));
    }
  }, [
    navigate,
    profile,
    profileLoading,
    hasOrg,
    finishedRoute,
    homeRoute,
    hostAccessWithheld,
    isEditMode,
    completingChecklistStep,
    pendingAccess,
    isLeaving,
    renewsConsents,
  ]);

  const leaveTo = async (target: string, rentalType: RentalType) => {
    setIsLeaving(true);
    try {
      // Host policies and this bootstrap both resolve persisted DB memberships. Auth0 role synchronization is
      // separate: a failed M2M call must not block a workspace the server has already authorized.
      await confirmWorkspaceAccess(client, target);
      // Keep SDK claims fresh when possible, without forcing a new sign-in or delaying access.
      void refreshAccessToken().catch(() => undefined);
      navigate(target, { replace: true });
    } catch {
      setIsLeaving(false);
      setPendingAccess({ rentalType, target });
    }
  };

  const finishOnboarding = async (
    rentalType: RentalType,
    acceptedConsents: OnboardingConsentsPayload | null = consents,
  ) => {
    setSelectedType(rentalType);
    setFailedType(null);

    if (isDemoMode) {
      applyDemoOnboardingProfile(rentalType);
      setIsLeaving(true);
      window.location.assign(getPostOnboardingRoute(rentalType, from, { firstRun: true, guidedSetup: flags.octorateOnboarding }));
      return;
    }

    if (needsConsentsStep && !acceptedConsents) {
      toast.error(t('onboarding.consentRequiredToast'));
      setStep('consents');
      return;
    }

    let result: OnboardingResponse;
    try {
      result = await completeOnboarding.mutateAsync({
        rentalType,
        isUpdate,
        consents: needsConsentsStep ? acceptedConsents ?? undefined : undefined,
      });
    } catch (error) {
      if (isAxiosError(error) && getProblemCode(error.response?.data) === CONSENTS_REQUIRED_CODE) {
        // The profile was stale: the backend has no org for this user yet, which needs the consents first.
        setConsentsForced(true);
        setStep('consents');
        toast.error(t('onboarding.consentRequiredToast'));
        return;
      }
      if (getStaleConsentDocuments(error)) {
        // A1-39: a legal document changed while the user was in the wizard. The cached versions are dropped and the
        // current ones must be accepted again, otherwise every new attempt would send the same outdated versions.
        setConsents(null);
        setConsentsAttempt((attempt) => attempt + 1);
        void reloadLegalDocuments();
        setStep('consents');
        toast.error(t('onboarding.consentsStaleToast'));
        return;
      }
      setFailedType(rentalType);
      toast.error(getProblemMessage(error, t) ?? t('onboarding.configurationErrorToast'));
      return;
    }

    if (result.orgProvisioned) {
      // SE-03: the first onboarding created the org, the attribution captured on /signup can be sent now. Awaited
      // before leaving (the page reloads); a failure keeps it for the next page load, never blocks the onboarding.
      markSignupAttributionReady();
      await syncSignupAttribution();
    }

    const target = isEditMode
      ? getProfilePageForRentalType(rentalType)
      : getPostOnboardingRoute(rentalType, from, { firstRun: result.orgProvisioned === true, guidedSetup: flags.octorateOnboarding });
    setPendingAccess(null);
    await leaveTo(target, rentalType);
  };

  const handleRentalSelect = (rentalType: RentalType) => {
    setSelectedType(rentalType);
    // In edit mode the choice is confirmed with the save button of the role step.
    if (isEditMode) return;
    if (needsConsentsStep) {
      setStep('consents');
      return;
    }
    void finishOnboarding(rentalType);
  };

  const handleEditSave = () => {
    if (!selectedType) return;
    if (needsConsentsStep) {
      setStep('consents');
      return;
    }
    void finishOnboarding(selectedType);
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

  if (pendingAccess) {
    return (
      <div className="min-h-dvh border-t-4 border-primary bg-muted/40 px-4 py-6 sm:py-12">
        <WorkspaceAccessError
          onRetry={() => void leaveTo(pendingAccess.target, pendingAccess.rentalType)}
        />
      </div>
    );
  }

  const heading =
    step === 'role'
      ? isEditMode
        ? t('onboarding.editOperatorType')
        : t('onboarding.howToUse')
      : renewsConsents
        ? t('onboarding.consentsRenewalTitle')
        : t('onboarding.acceptLegalDocs');

  const subheading =
    step === 'role'
      ? isEditMode
        ? t('onboarding.editRoleDescription')
        : t('onboarding.roleDescription')
      : renewsConsents
        ? t('onboarding.consentsRenewalDescription')
        : t('onboarding.consentsDescription');

  const showStepper = !isEditMode && !renewsConsents;

  return (
    <div className="min-h-dvh border-t-4 border-primary bg-muted/40 px-4 py-6 sm:py-12">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3 rounded-2xl border bg-card p-5 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t('onboarding.casaZen')}</p>
          {showStepper ? (
            <>
              <p className="text-sm text-muted-foreground" data-testid="onboarding-step-of">
                {t('onboarding.stepOf', {
                  current: WIZARD_STEPS.indexOf(step) + 1,
                  total: WIZARD_STEPS.length,
                })}
              </p>
              <ol
                className="flex flex-wrap items-center gap-2 text-sm"
                aria-label={t('onboarding.stepsLabel')}
                data-testid="onboarding-steps"
              >
                {WIZARD_STEPS.map((wizardStep, index) => {
                  const current = wizardStep === step;
                  const done = WIZARD_STEPS.indexOf(step) > index;
                  return (
                    <li
                      key={wizardStep}
                      aria-current={current ? 'step' : undefined}
                      className={current ? 'rounded-full bg-primary px-3 py-1.5 font-semibold text-primary-foreground' : done ? 'rounded-full bg-muted px-3 py-1.5 text-primary' : 'rounded-full px-3 py-1.5 text-muted-foreground'}
                    >
                      <span className="mr-1">{index + 1}.</span>
                      {t(`onboarding.steps.${wizardStep}`)}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : null}
          <h1 ref={headingRef} tabIndex={-1} className="text-3xl font-bold tracking-tight outline-none sm:text-4xl">{heading}</h1>
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

        {step === 'role' && isEditMode ? (
          <div className="flex flex-wrap items-center justify-center gap-3" data-testid="onboarding-edit-actions">
            <Button
              type="button"
              variant="outline"
              disabled={completeOnboarding.isPending}
              onClick={() => navigate(from ?? homeRoute)}
            >
              {t('onboarding.cancel')}
            </Button>
            <Button
              type="button"
              data-testid="onboarding-edit-save"
              disabled={
                completeOnboarding.isPending ||
                !selectedType ||
                (!needsConsentsStep && selectedType === profile?.rentalType)
              }
              onClick={handleEditSave}
            >
              {completeOnboarding.isPending
                ? t('onboarding.configuring')
                : needsConsentsStep
                  ? t('onboarding.continue')
                  : t('onboarding.saveChanges')}
            </Button>
          </div>
        ) : null}

        {step === 'role' && !isEditMode && !linkedSupplier ? (
          <SupplierEntryLink
            onRegister={() => navigate('/register')}
            onClaim={() => navigate(SUPPLIER_CLAIM_PATH)}
          />
        ) : null}

        {step === 'role' && canSkip ? (
          <div className="space-y-2" data-testid="onboarding-skip">
            <p className="text-sm text-muted-foreground">{t('onboarding.skipDescription')}</p>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(homeRoute, { replace: true })}
            >
              {t('onboarding.skipForNow')}
            </Button>
          </div>
        ) : null}

        {step === 'consents' ? (
          <ConsentsStep
            key={consentsAttempt}
            onBack={() => setStep('role')}
            onContinue={(payload) => {
              setConsents(payload);
              if (selectedType) void finishOnboarding(selectedType, payload);
            }}
            isLoading={completeOnboarding.isPending}
          />
        ) : null}

        {failedType && !completeOnboarding.isPending ? (
          <button
            type="button"
            data-testid="onboarding-retry"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => void finishOnboarding(failedType)}
          >
            {t('onboarding.retry')}
          </button>
        ) : null}
      </div>
    </div>
  );
}
