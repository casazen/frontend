import { useEffect, useMemo, useRef, useState } from 'react';
import { clearCommercialDraft, readCommercialDraft, saveCommercialDraft } from './commercial-draft';
import { confirmWorkspaceAccess, PAYMENT_REQUIRED } from './confirm-workspace-access';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Building2, Check, Home, LockKeyhole, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { Button } from '@/components/ui/button';
import { UsersApi } from '@/api/users.api';
import { CommercialSignupApi } from '@/api/commercial-signup.api';
import { useBillingPlans, useBillingSubscription, useOpenBillingPortal, useStartCheckout } from '@/queries/use-billing';
import { getProblemMessage } from '@/lib/api-errors';
import { getFirstPropertyRoute, getHomeRouteForRentalType, getStaleConsentDocuments } from '@/lib/onboarding';
import type { BillingPlan, RentalType, UserDetail } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import { ConsentsStep } from './components/consents-step';
import { addonsForTier, agencyBaseEstimate, allowsExtras, applicableAddons, commercialUnitPrice, signupRentalType, type CommercialSelection, type SignupProfile } from './commercial-model';
import { useReloadLegalDocuments } from '@/queries/use-legal';
import { markSignupAttributionReady, syncSignupAttribution } from '@/lib/signup-attribution';
import { BillingProfileForm } from '@/features/billing/components/billing-profile-form';
import { toBillingProfileRequest } from '@/features/billing/billing-profile.schema';

const PROFILES = [
  { id: 'agency', icon: Building2 }, { id: 'owner', icon: Home },
  { id: 'supplier', icon: Wrench },
] as const;
const RENTAL_AREA_LABEL = {
  ShortTerm: 'commercial.shortRent',
  LongTerm: 'commercial.longRent',
  Both: 'commercial.bothAreas',
} as const satisfies Record<RentalType, string>;
const RENTAL_AREAS = ['ShortTerm', 'LongTerm', 'Both'] as const;
const STEPS = ['profile', 'features', 'summary', 'payment', 'ready'] as const;
type Step = typeof STEPS[number];

export function CommercialSignupWizard({ profile }: { profile: UserDetail | undefined }) {
  // A change of identity or a server provisioning result starts a fresh wizard in the verified scope.
  const scopeKey = JSON.stringify([profile?.id, profile?.orgId, Boolean(profile?.commercialSignup)]);
  return <SignupFlow key={scopeKey} profile={profile} />;
}

function SignupFlow({ profile }: { profile: UserDetail | undefined }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const client = useQueryClient();
  const existing = profile?.commercialSignup;
  const scope = useMemo(() => profile?.id ? { userId: profile.id, orgId: profile.orgId ?? null } : null, [profile?.id, profile?.orgId]);
  const [restored] = useState(() => scope && !existing ? readCommercialDraft(scope) : null);
  const [paused, setPaused] = useState<null | 'saved' | 'memory'>(null);
  const [showRestored, setShowRestored] = useState(Boolean(restored));
  const [nameError, setNameError] = useState(false);
  const agencyNameInput = useRef<HTMLInputElement>(null);
  const [selection, setSelection] = useState<CommercialSelection | null>(existing ?? restored?.values.selection ?? null);
  const [roomEstimate, setRoomEstimate] = useState(restored?.values.roomEstimate ?? '1');
  const [step, setStep] = useState<Step>(existing ? 'payment' : restored?.step ?? 'profile');
  const [consenting, setConsenting] = useState(false);
  const [consentsAttempt, setConsentsAttempt] = useState(0);
  const reloadLegal = useReloadLegalDocuments();
  const [provisioned, setProvisioned] = useState(!!profile?.orgId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const plans = useBillingPlans(step !== 'profile');
  const catalog = useQuery({ queryKey: ['billing', 'commercial-catalog'], queryFn: CommercialSignupApi.getCatalog, enabled: step !== 'profile' });
  const checkout = useStartCheckout();
  const portal = useOpenBillingPortal('/onboarding');
  const subscription = useBillingSubscription({
    enabled: provisioned,
    pollInterval: data => step === 'payment' && params.get('checkout') === 'success' && data?.status !== 'active' && data?.status !== 'trialing' ? 2500 : false,
  });
  const hasSubscription = subscription.data && !['none', 'canceled'].includes(subscription.data.status);
  const paid = subscription.data?.status === 'active' || subscription.data?.status === 'trialing';
  const currentStep = paid ? 'ready' : step;
  const listedPlan = plans.data?.find(item => item.tier === selection?.planTier);
  const plan = listedPlan?.tier === 'Agency' ? {
    ...listedPlan, priceMonthly: listedPlan.agencyTariff?.bands[0]?.unitPrice ?? 0,
    purchasable: listedPlan.agencyTariff?.purchasable === true,
  } : listedPlan;
  const rentalArea = selection ? signupRentalType(selection) : 'ShortTerm';
  const isAgency = selection?.profile === 'agency';
  const addons = applicableAddons(addonsForTier(catalog.data ?? [], selection?.planTier ?? 'Starter'), rentalArea);
  const includedAddons = addons.filter(addon => selection && addon.includedInPlans?.includes(selection.planTier));
  const optionalAddons = addons.filter(addon => !includedAddons.includes(addon));
  const selectedExtras = selection?.addons.filter(code => !includedAddons.some(addon => addon.code === code)) ?? [];
  const includedFeatures = [
    ...(rentalArea !== 'LongTerm' ? [t('commercial.baseShort')] : []),
    ...(rentalArea !== 'LongTerm' && selection?.planTier === 'Starter' ? [t('commercial.icalSync')] : []),
    ...(rentalArea !== 'ShortTerm' ? [t('commercial.baseLong')] : []),
    t('commercial.baseCommon'),
    ...(plan?.features ?? []),
    ...includedAddons.flatMap(addon => addon.code === 'channels'
      ? [t('commercial.otaSync'), t('commercial.otaContentSync'), t('commercial.otaMessaging')]
      : [t(`commercial.addons.${addon.code}.title`)]),
  ];
  const showEstimate = currentStep !== 'ready' && (!isAgency || (!provisioned && (step === 'features' || step === 'summary')));
  const estimateQuantity = isAgency ? Number(roomEstimate) : 1;
  const validEstimate = roomEstimate !== '' && Number.isSafeInteger(estimateQuantity) && estimateQuantity >= 0 && estimateQuantity <= 10000;
  const unitTotal = selection ? commercialUnitPrice(plan, addons, selection) : null;
  const baseEstimate = isAgency ? agencyBaseEstimate(plan?.agencyTariff, estimateQuantity) : plan?.priceMonthly ?? null;
  const customQuote = isAgency && !!plan?.agencyTariff && estimateQuantity >= plan.agencyTariff.quoteFrom;
  const total = plan && baseEstimate !== null && unitTotal !== null && validEstimate
    ? baseEstimate + (unitTotal - plan.priceMonthly) * estimateQuantity : null;
  const activationLabel = t(isAgency ? 'commercial.agency.continue' : 'commercial.continuePayment');
  const money = (amount: number, currency = plan?.currency ?? 'EUR') => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(amount);
  const priceText = (item: BillingPlan) => item.priceMonthly > 0 ? money(item.priceMonthly, item.currency) : t('commercial.pricePending');
  const pendingPayment = params.get('checkout') === 'success' && !paid;
  const canGoBack = currentStep === 'features' || (currentStep === 'summary' && !provisioned) ||
    (currentStep === 'payment' && !pendingPayment);
  const agencyValid = selection?.profile !== 'agency' || (!!selection.agencyName?.trim() && selection.agencyName.trim().length <= 200);
  const pricingError = plans.isError || catalog.isError;
  const loadingPrices = plans.isPending || catalog.isPending;
  const canPay = !pricingError && !loadingPrices && (!isAgency || !!plan?.agencyTariff) && unitTotal !== null && agencyValid && !!plan?.purchasable && selection?.addons.every(code => addons.some(a => a.code === code && a.purchasable)) === true;

  useEffect(() => {
    document.getElementById('commercial-title')?.focus();
  }, [currentStep, consenting, paused, consentsAttempt]);

  useEffect(() => {
    if (scope && !existing && !provisioned && !paid && selection && (step === 'profile' || step === 'features' || step === 'summary')) {
      saveCommercialDraft(scope, step, selection, roomEstimate);
    }
  }, [scope, existing, provisioned, paid, selection, step, roomEstimate]);

  function pause() {
    if (!selection || (step !== 'features' && step !== 'summary')) return;
    const saved = scope && saveCommercialDraft(scope, step, selection, roomEstimate);
    setConsenting(false);
    setPaused(saved ? 'saved' : 'memory');
    setShowRestored(false);
  }

  function review() {
    setShowRestored(false);
    if (!agencyValid) {
      setNameError(true);
      agencyNameInput.current?.focus();
      return;
    }
    setStep('summary');
  }

  function chooseProfile(value: SignupProfile) {
    if (value === 'supplier') { navigate('/register'); return; }
    if (selection?.profile !== value) {
      setRoomEstimate('1');
      setSelection({ profile: value, rentalArea: 'ShortTerm', planTier: value === 'agency' ? 'Agency' : 'Starter', rooms: 1, addons: [] });
    }
    setNameError(false);
    setShowRestored(false);
    setError(null);
    setStep('features');
  }

  function goBack() {
    setError(null);
    if (consenting) setConsenting(false);
    else if (currentStep === 'payment') setStep('summary');
    else if (currentStep === 'summary') setStep('features');
    else setStep('profile');
  }

  function chooseRentalArea(area: RentalType) {
    if (!selection) return;
    const eligible = applicableAddons(catalog.data ?? [], area);
    setSelection({ ...selection, rentalArea: area, addons: selection.addons.filter(code => eligible.some(addon => addon.code === code)) });
  }

  function choosePlan(tier: BillingPlan['tier']) {
    if (!selection) return;
    const nextAddons = addonsForTier(catalog.data ?? [], tier);
    setSelection({ ...selection, planTier: tier, addons: allowsExtras(tier) ? selection.addons.filter(code => {
      const next = nextAddons.find(addon => addon.code === code);
      if (!next?.purchasable || next.priceMonthly === null) return false;
      return !next.includedInPlans?.includes(selection.planTier) || next.includedInPlans.includes(tier);
    }) : [] });
  }

  async function provision(consents: OnboardingConsentsPayload) {
    if (!selection) return;
    const signup = { ...selection, addons: [...selectedExtras, ...includedAddons.map(addon => addon.code)] };
    setBusy(true); setError(null);
    try {
      const result = await UsersApi.postOnboarding({ rentalType: rentalArea, commercialSignup: signup, consents });
      setSelection(signup);
      if (scope) clearCommercialDraft(scope);
      if (result.orgProvisioned) { markSignupAttributionReady(); await syncSignupAttribution(); }
      // Memberships are already saved in the database. Resolve the profile before opening billing.
      await client.invalidateQueries({ queryKey: ['me'] });
      setProvisioned(true);
      setConsenting(false);
      setStep('payment');
    } catch (err) {
      if (getStaleConsentDocuments(err)) {
        setConsentsAttempt(attempt => attempt + 1);
        void reloadLegal();
      }
      setError(getProblemMessage(err, t) ?? t('commercial.failed'));
    } finally { setBusy(false); }
  }

  async function enter() {
    if (!paid || !selection) return;
    setBusy(true); setError(null);
    try {
      const target = await confirmWorkspaceAccess(client, me => {
        const area = me.commercialSignup ? signupRentalType(me.commercialSignup) : me.rentalType ?? rentalArea;
        return me.hasProperties === false ? getFirstPropertyRoute(area) : getHomeRouteForRentalType(area);
      });
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error && err.message === PAYMENT_REQUIRED
        ? t(isAgency ? 'commercial.agency.pending' : 'commercial.paymentPending')
        : getProblemMessage(err, t) ?? t('onboardingAccess.description'));
    }
    finally { setBusy(false); }
  }

  const headingKey = consenting ? 'consents' : currentStep;
  const descriptionKey = isAgency && ['consents', 'summary', 'payment', 'ready'].includes(headingKey)
    ? 'commercial.agency.setupDescription' : `commercial.descriptions.${headingKey}`;
  const tariff = isAgency ? plan?.agencyTariff : null;
  const agencyRates = tariff && <div className="space-y-2 text-sm">
    <dl className="space-y-1">{tariff.bands.map((band, i) => <div key={band.upTo} className="flex justify-between gap-4">
      <dt>{t('commercial.agency.band', { from: i === 0 ? 0 : tariff.bands[i - 1].upTo + 1, to: band.upTo })}</dt>
      <dd>{money(band.unitPrice)}{t('commercial.perRoomMonth')}</dd>
    </div>)}</dl>
    <p>{t(plan?.pricesIncludeVat ? 'commercial.agency.minimumVatIncluded' : 'commercial.agency.minimum', { amount: money(tariff.minimum), threshold: tariff.quoteFrom })}</p>
  </div>;
  return (
    <main className="min-h-dvh bg-[#f6f4f0] text-[#1f3a3d]" data-testid="commercial-signup">
      <header className="border-b border-[#1f3a3d]/10 bg-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <CasaZenLogo size={34} />
          <span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" />{t('commercial.secure')}</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        {paused ? <section className="mx-auto max-w-lg space-y-5 rounded-2xl border bg-white p-5 sm:p-7">
          <h1 id="commercial-title" tabIndex={-1} className="text-2xl font-semibold outline-none">{t('commercial.pauseTitle')}</h1>
          <p>{t(paused === 'saved' ? 'commercial.pauseSaved' : 'commercial.pauseMemory')}</p>
          <p className="text-sm text-muted-foreground">{t('commercial.resumeFrom', { step: t(`commercial.steps.${step}`) })}</p>
          <Button onClick={() => setPaused(null)}>{t('commercial.resume')}</Button>
        </section> : <>
        <ol aria-label={t('commercial.progress')} className="mb-4 flex gap-2 rounded-2xl border bg-card p-4 sm:mb-8 sm:gap-5 sm:p-5">
          {STEPS.map((item, index) => {
            const active = STEPS.indexOf(currentStep);
            return <li key={item} aria-current={item === currentStep ? 'step' : undefined} className="min-w-0 flex-1">
              <div className={`mb-3 h-1 rounded-full ${index <= active ? 'bg-[#1f3a3d]' : 'bg-[#1f3a3d]/10'}`} />
              <span className={`flex items-center gap-2 text-xs sm:text-sm ${index === active ? 'font-semibold' : 'text-muted-foreground'}`}>
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current text-[10px]">{index < active ? <Check className="size-3" aria-hidden="true" /> : index + 1}</span>
                <span className="sr-only sm:not-sr-only">{t(isAgency && item === 'payment' ? 'commercial.agency.billing' : `commercial.steps.${item}`)}</span>
              </span>
            </li>;
          })}
        </ol>
        <p className="mb-4 text-sm font-medium sm:hidden">{t('commercial.stepPosition', { current: STEPS.indexOf(currentStep) + 1, total: STEPS.length, step: t(isAgency && currentStep === 'payment' ? 'commercial.agency.billing' : `commercial.steps.${currentStep}`) })}</p>
        {canGoBack && <Button type="button" variant="outline" className="mb-5" onClick={goBack} disabled={busy || checkout.isPending || checkout.isSuccess || portal.isPending}>
          <ArrowLeft className="size-4" aria-hidden="true" />{t('commercial.back')}
        </Button>}
        <div className="mb-6 max-w-3xl space-y-3">
          <h1 id="commercial-title" tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{t(isAgency && consenting ? 'commercial.agency.consents' : `commercial.headings.${headingKey}`)}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t(descriptionKey)}</p>
          {showRestored && <p role="status" className="text-sm font-medium">{t('commercial.restored')}</p>}
          {!provisioned && !existing && (currentStep === 'features' || currentStep === 'summary') &&
            <Button type="button" variant="link" disabled={busy} className="min-h-11 px-0" onClick={pause}>{t('commercial.pause')}</Button>}
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-white p-4 text-sm text-destructive">{error}</p>}

        {currentStep === 'profile' && <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {PROFILES.map(({ id, icon: Icon }) => <button key={id} type="button" onClick={() => chooseProfile(id)} data-testid={`signup-profile-${id}`} className="group flex min-w-0 flex-col items-start gap-4 rounded-2xl border border-input bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring sm:p-6">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#edf2ef]"><Icon className="size-6" aria-hidden="true" /></span>
              <span className="flex-1 space-y-2"><span className="block text-xl font-semibold">{t(`commercial.profiles.${id}.title`)}</span><span className="block text-sm leading-relaxed text-muted-foreground">{t(`commercial.profiles.${id}.text`)}</span><span className="block pt-1 text-xs font-medium text-[#b34d25]">{t(`commercial.profiles.${id}.hint`)}</span></span>
              <ArrowRight className="mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>)}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t('commercial.invitationOnly')}</p>
        </>}

        {selection && currentStep !== 'profile' && <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {currentStep !== 'ready' && (pricingError ? <div role="alert" className="space-y-3 rounded-xl border bg-white p-5">
              <p>{t('commercial.catalogError')}</p>
              <Button variant="outline" onClick={() => { void plans.refetch(); void catalog.refetch(); }}>{t('commercial.retry')}</Button>
            </div> : loadingPrices ? <p role="status">{t('commercial.loading')}</p> : null)}
            {currentStep === 'features' && <>
              <fieldset className="space-y-3">
                <legend className="text-lg font-semibold">{t('commercial.chooseRentalArea')}</legend>
                <div className="flex flex-wrap gap-3">
                  {RENTAL_AREAS.map(area => <label key={area} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border bg-white px-4">
                    <input type="radio" name="rental-area" value={area} checked={rentalArea === area} onChange={() => chooseRentalArea(area)} className="accent-[#1f3a3d]" />
                    {t(RENTAL_AREA_LABEL[area])}
                  </label>)}
                </div>
              </fieldset>
              {selection.profile === 'agency' ? <section className="space-y-4 rounded-2xl border bg-white p-6">
                <h2 className="text-lg font-semibold">{t('commercial.agency.create')}</h2>
                <label className="block space-y-2 text-sm font-medium" htmlFor="signup-agency-name"><span>{t('commercial.agency.name')}</span><input id="signup-agency-name" ref={agencyNameInput} aria-invalid={nameError && !agencyValid} aria-describedby={nameError && !agencyValid ? 'signup-agency-error' : undefined} autoComplete="organization" required maxLength={200} value={selection.agencyName ?? ''} onChange={event => setSelection({ ...selection, agencyName: event.target.value })} className="block min-h-11 w-full rounded-lg border bg-background px-3 text-base" /></label>
                {nameError && !agencyValid && <p id="signup-agency-error" role="alert" className="text-sm text-destructive">{t('commercial.agencyNameRequired')}</p>}
                <p className="rounded-xl bg-[#edf2ef] p-4 text-sm">{t('commercial.agency.admin')}</p>
                <h3 className="font-semibold">{t('commercial.agency.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('commercial.agency.explanation')}</p>
                <label className="block space-y-2 text-sm font-medium" htmlFor="signup-rooms"><span>{t('commercial.agency.rooms')}</span><input id="signup-rooms" type="number" min={0} max={10000} step={1} value={roomEstimate} onChange={event => setRoomEstimate(event.target.value)} className="block min-h-11 w-32 rounded-lg border bg-background px-3 text-base" /></label>
                {agencyRates}
              </section> : <section className="space-y-3">
                <h2 className="text-lg font-semibold">{t('commercial.choosePlan')}</h2>
                <div className="grid gap-3 sm:grid-cols-3">{(plans.data ?? []).filter(item => item.tier !== 'Agency').map(item => <button type="button" key={item.tier} onClick={() => choosePlan(item.tier)} aria-pressed={item.tier === selection.planTier} className={`min-h-36 rounded-xl border-2 bg-white p-4 text-left ${item.tier === selection.planTier ? 'border-[#1f3a3d]' : 'border-transparent shadow-sm'}`}>
                  <span className="flex items-center justify-between gap-2 font-semibold">{item.displayName}{item.tier === selection.planTier && <Check className="size-4" aria-hidden="true" />}</span>
                  <span className="mt-3 block text-lg font-semibold">{priceText(item)}</span><span className="block text-xs text-muted-foreground">{t(item.pricesIncludeVat ? 'commercial.perMonthVatIncluded' : 'commercial.perMonth')}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">{item.unitAllowance < 0 ? t('commercial.unlimited') : t('commercial.properties', { count: item.unitAllowance })}</span>
                </button>)}</div>
              </section>}
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Check className="size-5" aria-hidden="true" />{t('commercial.included')}</h2>
                <ul className="grid gap-3 text-sm sm:grid-cols-2">{includedFeatures.map(feature => <li key={feature} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#467b67]" aria-hidden="true" />{feature}</li>)}</ul>
              </section>
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-5" aria-hidden="true" />{t('commercial.extras')}</h2>
                <p className="text-sm text-muted-foreground">{t('commercial.extrasDescription')}</p>
                {!allowsExtras(selection.planTier) && <p className="flex gap-2 rounded-xl bg-[#efe8dc] p-4 text-sm"><LockKeyhole className="size-4 shrink-0" aria-hidden="true" />{t('commercial.proRequired')}</p>}
                <div className="grid gap-3 sm:grid-cols-2">{optionalAddons.map(addon => {
                  const selected = selection.addons.includes(addon.code);
                  const disabled = !selected && (!allowsExtras(selection.planTier) || !addon.purchasable || addon.priceMonthly === null);
                  return <label key={addon.code} className={`flex gap-3 rounded-xl border bg-white p-5 ${disabled ? 'opacity-70' : 'cursor-pointer hover:border-[#1f3a3d]'} ${selected ? 'ring-1 ring-[#1f3a3d]' : ''}`}>
                    <input type="checkbox" disabled={disabled} checked={selected} onChange={event => setSelection({ ...selection, addons: event.target.checked ? [...selection.addons, addon.code] : selection.addons.filter(code => code !== addon.code) })} className="mt-1 size-4 shrink-0 accent-[#1f3a3d]" />
                    <span className="space-y-1"><span className="block text-sm font-semibold">{t(`commercial.addons.${addon.code}.title`)}</span><span className="block text-xs leading-relaxed text-muted-foreground">{t(`commercial.addons.${addon.code}.text`)}</span>{allowsExtras(selection.planTier) && <span className="block pt-1 text-xs font-medium">{addon.priceMonthly === null ? t('commercial.pricePending') : !addon.purchasable ? t('commercial.unavailable') : `${money(addon.priceMonthly, addon.currency)}${t(selection.profile === 'agency' ? 'commercial.perRoomMonth' : 'commercial.monthSuffix')}`}</span>}</span>
                  </label>;
                })}</div>
              </section>
              <div className="flex justify-end gap-3"><Button onClick={review} disabled={!plan || plans.isError || catalog.isPending || catalog.isError}>{t('commercial.review')}<ArrowRight className="size-4" /></Button></div>
            </>}

            {currentStep === 'summary' && (!consenting ? <section className="space-y-5 rounded-2xl border bg-white p-6">
              <h2 className="text-xl font-semibold">{t('commercial.yourSetup')}</h2>{selection.profile === 'agency' && <p className="font-medium">{selection.agencyName}</p>}
              <dl className="space-y-4 text-sm">{[{ label: t('commercial.labels.profile'), value: t(`commercial.profiles.${selection.profile}.title`) }, { label: t('commercial.labels.area'), value: t(RENTAL_AREA_LABEL[rentalArea]) }, { label: t('commercial.labels.plan'), value: plan?.displayName ?? selection.planTier }].map(({ label, value }) => <div key={label} className="flex flex-wrap justify-between gap-2 border-b pb-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
              <h3 className="font-semibold">{t('commercial.selectedExtras')}</h3>
              {selectedExtras.length ? <ul className="space-y-2 text-sm">{selectedExtras.map(code => <li key={code} className="flex items-center gap-2"><Check className="size-4" />{t(`commercial.addons.${code}.title`)}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t('commercial.noExtras')}</p>}
              <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => setStep('features')}>{t('commercial.edit')}</Button><Button onClick={() => { setShowRestored(false); if (provisioned) setStep('payment'); else setConsenting(true); }} disabled={!provisioned && !canPay}>{provisioned ? t('onboardingAccess.backToBilling') : activationLabel}<ArrowRight className="size-4" /></Button></div>
              {!provisioned && !canPay && !pricingError && !loadingPrices && <p role="status" className="text-sm text-muted-foreground">{t('commercial.notPurchasable')}</p>}
            </section> : <ConsentsStep key={consentsAttempt} onBack={() => setConsenting(false)} onContinue={payload => void provision(payload)} isLoading={busy} continueLabel={activationLabel} />)}

            {(currentStep === 'payment' || (currentStep === 'summary' && provisioned)) && <section hidden={currentStep !== 'payment'} className="space-y-5 rounded-2xl border bg-white p-6">
              {agencyRates}
              {pendingPayment ? <div role="status" className="space-y-4"><ShieldCheck className="size-10 text-[#467b67]" aria-hidden="true" /><h2 className="text-lg font-semibold">{t(isAgency ? 'commercial.agency.pending' : 'commercial.paymentPending')}</h2><p className="text-sm text-muted-foreground">{t(isAgency ? 'commercial.agency.setupDescription' : 'commercial.paymentPendingText')}</p><Button variant="outline" onClick={() => void subscription.refetch()}>{t(isAgency ? 'commercial.agency.check' : 'commercial.checkPayment')}</Button></div> : <>
                {params.get('checkout') === 'cancel' && <p role="status" className="rounded-xl bg-[#efe8dc] p-4 text-sm">{t(isAgency ? 'commercial.agency.canceled' : 'commercial.paymentCanceled')}</p>}
                <BillingProfileForm idPrefix="signup" defaultValues={{ billingCountry: subscription.data?.billingCountry ?? '', vatId: subscription.data?.vatId ?? '' }} submitLabel={t(isAgency ? 'commercial.agency.setup' : 'commercial.pay')} pendingLabel={t('commercial.redirecting')} isPending={checkout.isPending || checkout.isSuccess || !!hasSubscription || !canPay} onSubmit={values => {
                  checkout.mutate({ planTier: selection.planTier, commercialSignup: selection, returnPath: '/onboarding', ...toBillingProfileRequest(values) }, { onError: err => setError(getProblemMessage(err, t) ?? t('commercial.failed')) });
                }} />
                {hasSubscription && <Button variant="outline" loading={portal.isPending} onClick={() => portal.mutate()}>{t('commercial.resumePayment')}</Button>}
                {!canPay && !pricingError && !loadingPrices && <p role="status" className="text-sm text-muted-foreground">{t('commercial.notPurchasable')}</p>}
                <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><LockKeyhole className="size-4 shrink-0" aria-hidden="true" />{t(isAgency ? 'commercial.agency.setupDescription' : 'commercial.stripeNotice')}</p>
              </>}
              {subscription.isError && <p role="alert" className="text-sm text-destructive">{t('commercial.subscriptionError')}</p>}
            </section>}

            {currentStep === 'ready' && <section className="space-y-6 rounded-2xl border bg-white p-7">
              <span className="grid size-14 place-items-center rounded-full bg-[#edf2ef]"><Check className="size-7 text-[#467b67]" aria-hidden="true" /></span>
              <h2 className="text-2xl font-semibold">{t(profile?.hasProperties === false ? 'commercial.firstPropertyTitle' : 'commercial.workspaceTitle')}</h2><p className="text-muted-foreground">{t(profile?.hasProperties === false ? 'commercial.firstPropertyText' : 'commercial.workspaceText', { area: t(RENTAL_AREA_LABEL[rentalArea === 'LongTerm' ? 'LongTerm' : 'ShortTerm']) })}</p>{selection.profile === 'agency' && <p className="text-sm">{t('commercial.agency.inviteLater')}</p>}
              <Button loading={busy} onClick={() => void enter()}>{t('commercial.enter')}<ArrowRight className="size-4" /></Button>
            </section>}
          </div>
          {showEstimate && <aside aria-label={t(isAgency ? 'commercial.agency.estimate' : 'commercial.orderSummary')} className={`${currentStep === 'summary' || currentStep === 'payment' ? 'order-first lg:order-last' : ''} space-y-5 rounded-2xl border border-[#1f3a3d]/15 bg-white p-6 shadow-sm lg:sticky lg:top-6`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t(isAgency ? 'commercial.agency.estimate' : 'commercial.orderSummary')}</p>
            <h2 className="text-xl font-semibold">{plan?.displayName ?? selection.planTier}</h2>
            <p className="text-sm text-muted-foreground">{t(RENTAL_AREA_LABEL[rentalArea])}</p>
            {isAgency && validEstimate && <p className="rounded-lg bg-[#edf2ef] p-3 text-sm">{t('commercial.agency.estimateCount', { count: estimateQuantity })}</p>}
            {validEstimate && !customQuote && <ul className="space-y-3 text-sm"><li className="flex justify-between gap-2"><span>{t('commercial.basePlan')}</span><span>{plan && plan.priceMonthly > 0 && baseEstimate !== null ? money(baseEstimate) : t('commercial.pricePending')}</span></li>{selectedExtras.map(code => {
              const addon = addons.find(item => item.code === code);
              return <li key={code} className="flex justify-between gap-2"><span>{t(`commercial.addons.${code}.title`)}</span><span className="shrink-0">{addon?.priceMonthly != null ? money(addon.priceMonthly * estimateQuantity, addon.currency) : t('commercial.pricePending')}</span></li>;
            })}</ul>}
            <div className="border-t pt-4" aria-live="polite"><p className="text-sm">{t(isAgency ? 'commercial.agency.total' : 'commercial.total')}</p><p className="mt-2 text-3xl font-semibold">{total === null ? <span className="text-lg">{t(customQuote ? 'commercial.agency.customQuote' : validEstimate ? 'commercial.pricePending' : 'commercial.agency.enterRooms')}</span> : money(total)}</p><p className="mt-1 text-xs text-muted-foreground">{t(plan?.pricesIncludeVat ? 'commercial.taxIncluded' : isAgency ? 'commercial.agency.tax' : 'commercial.taxNote')}</p></div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('commercial.changeLater')}</p>
          </aside>}
        </div>}
        </>}
      </div>
    </main>
  );
}
