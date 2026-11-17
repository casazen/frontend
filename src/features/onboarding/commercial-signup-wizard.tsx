import { useEffect, useState } from 'react';
import { confirmWorkspaceAccess } from './confirm-workspace-access';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Building2, Check, Home, KeyRound, LockKeyhole, ShieldCheck, Sparkles, Wrench } from 'lucide-react';
import { CasaZenLogo } from '@/components/brand/casazen-mark';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { UsersApi } from '@/api/users.api';
import { CommercialSignupApi } from '@/api/commercial-signup.api';
import { useBillingPlans, useBillingSubscription, useOpenBillingPortal, useStartCheckout } from '@/queries/use-billing';
import { getProblemMessage } from '@/lib/api-errors';
import { getFirstPropertyRoute, getHomeRouteForRentalType, getStaleConsentDocuments } from '@/lib/onboarding';
import type { BillingPlan, UserDetail } from '@/types';
import type { OnboardingConsentsPayload } from '@/types/onboarding.types';
import { ConsentsStep } from './components/consents-step';
import { allowsExtras, applicableAddons, billingQuantity, commercialTotal, signupRentalType, type CommercialSelection, type SignupProfile } from './commercial-model';
import { useReloadLegalDocuments } from '@/queries/use-legal';
import { markSignupAttributionReady, syncSignupAttribution } from '@/lib/signup-attribution';
import { BillingProfileForm } from '@/features/billing/components/billing-profile-form';
import { toBillingProfileRequest } from '@/features/billing/billing-profile.schema';

const PROFILES = [
  { id: 'agency', icon: Building2 }, { id: 'owner', icon: Home },
  { id: 'supplier', icon: Wrench }, { id: 'long-rent', icon: KeyRound },
] as const;
const STEPS = ['profile', 'features', 'summary', 'payment', 'ready'] as const;
type Step = typeof STEPS[number];

export function CommercialSignupWizard({ profile }: { profile: UserDetail | undefined }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const client = useQueryClient();
  const auth = useAuth();
  const existing = profile?.commercialSignup;
  const [selection, setSelection] = useState<CommercialSelection | null>(existing ?? null);
  const [step, setStep] = useState<Step>(existing ? 'payment' : 'profile');
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
  const plan = plans.data?.find(item => item.tier === selection?.planTier);
  const addons = applicableAddons(catalog.data ?? [], selection?.profile ?? 'owner');
  const total = selection ? commercialTotal(plan, addons, selection) : null;
  const money = (amount: number, currency = plan?.currency ?? 'EUR') => new Intl.NumberFormat(i18n.language, { style: 'currency', currency }).format(amount);
  const priceText = (item: BillingPlan) => item.priceMonthly > 0 ? money(item.priceMonthly, item.currency) : t('commercial.pricePending');
  const pendingPayment = params.get('checkout') === 'success' && !paid;
  const agencyValid = selection?.profile !== 'agency' || (!!selection.agencyName?.trim() && selection.agencyName.trim().length <= 200);
  const canPay = total !== null && agencyValid && !!plan?.purchasable && selection?.addons.every(code => addons.some(a => a.code === code && a.purchasable)) === true;

  useEffect(() => {
    document.getElementById('commercial-title')?.focus();
  }, [currentStep, consenting]);

  function chooseProfile(value: SignupProfile) {
    if (value === 'supplier') { navigate('/register'); return; }
    setSelection({ profile: value, planTier: value === 'agency' ? 'Agency' : 'Starter', rooms: 1, addons: [] });
    setError(null);
    setStep('features');
  }

  function choosePlan(tier: BillingPlan['tier']) {
    if (!selection) return;
    setSelection({ ...selection, planTier: tier, addons: allowsExtras(tier) ? selection.addons : [] });
  }

  async function provision(consents: OnboardingConsentsPayload) {
    if (!selection) return;
    setBusy(true); setError(null);
    try {
      const result = await UsersApi.postOnboarding({ rentalType: signupRentalType(selection.profile), commercialSignup: selection, consents });
      if (result.orgProvisioned) { markSignupAttributionReady(); await syncSignupAttribution(); }
      setProvisioned(true);
      setConsenting(false);
      setStep('payment');
      // DB memberships are already persisted; Auth0 synchronization must not block payment/setup.
      void auth.refreshAccessToken().catch(() => undefined);
      // Keep the draft server-side through the profile query, including after Stripe or a browser refresh.
      await client.invalidateQueries({ queryKey: ['me'] });
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
      const me = await UsersApi.getMe();
      if (me.commercialSetupRequired) { setError(t('commercial.paymentPending')); return; }
      await client.invalidateQueries({ queryKey: ['me'] });
      const rentalType = signupRentalType(selection.profile);
      const target = me.hasProperties === false ? getFirstPropertyRoute(rentalType) : getHomeRouteForRentalType(rentalType);
      await confirmWorkspaceAccess(client, target);
      void auth.refreshAccessToken().catch(() => undefined);
      navigate(target, { replace: true });
    } catch (err) { setError(getProblemMessage(err, t) ?? t('onboardingAccess.description')); }
    finally { setBusy(false); }
  }

  const headingKey = consenting ? 'consents' : currentStep;
  return (
    <main className="min-h-dvh bg-[#f6f4f0] text-[#1f3a3d]" data-testid="commercial-signup">
      <header className="border-b border-[#1f3a3d]/10 bg-white/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <CasaZenLogo size={34} />
          <span className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4" aria-hidden="true" />{t('commercial.secure')}</span>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <ol aria-label={t('commercial.progress')} className="mb-4 flex gap-2 sm:mb-10 sm:gap-5">
          {STEPS.map((item, index) => {
            const active = STEPS.indexOf(currentStep);
            return <li key={item} aria-current={item === currentStep ? 'step' : undefined} className="min-w-0 flex-1">
              <div className={`mb-3 h-1 rounded-full ${index <= active ? 'bg-[#1f3a3d]' : 'bg-[#1f3a3d]/10'}`} />
              <span className={`flex items-center gap-2 text-xs sm:text-sm ${index === active ? 'font-semibold' : 'text-muted-foreground'}`}>
                <span className="grid size-5 shrink-0 place-items-center rounded-full border border-current text-[10px]">{index < active ? <Check className="size-3" aria-hidden="true" /> : index + 1}</span>
                <span className="sr-only sm:not-sr-only">{t(`commercial.steps.${item}`)}</span>
              </span>
            </li>;
          })}
        </ol>
        <p className="mb-8 text-sm font-medium sm:hidden">{t(`commercial.steps.${currentStep}`)}</p>
        <div className="mb-8 max-w-2xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b34d25]">{t('commercial.kicker')}</p>
          <h1 id="commercial-title" tabIndex={-1} className="text-3xl font-semibold tracking-tight outline-none sm:text-4xl">{t(`commercial.headings.${headingKey}`)}</h1>
          <p className="text-base leading-relaxed text-muted-foreground">{t(`commercial.descriptions.${headingKey}`)}</p>
        </div>
        {error && <p role="alert" className="mb-5 rounded-xl border border-destructive/30 bg-white p-4 text-sm text-destructive">{error}</p>}

        {currentStep === 'profile' && <>
          <div className="grid gap-4 md:grid-cols-2">
            {PROFILES.map(({ id, icon: Icon }) => <button key={id} type="button" onClick={() => chooseProfile(id)} data-testid={`signup-profile-${id}`} className="group flex min-h-44 items-start gap-5 rounded-2xl border border-[#1f3a3d]/15 bg-white p-6 text-left shadow-sm transition hover:border-[#1f3a3d] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1f3a3d] sm:p-7">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#edf2ef]"><Icon className="size-6" aria-hidden="true" /></span>
              <span className="flex-1 space-y-2"><span className="block text-xl font-semibold">{t(`commercial.profiles.${id}.title`)}</span><span className="block text-sm leading-relaxed text-muted-foreground">{t(`commercial.profiles.${id}.text`)}</span><span className="block pt-1 text-xs font-medium text-[#b34d25]">{t(`commercial.profiles.${id}.hint`)}</span></span>
              <ArrowRight className="mt-1 size-5 shrink-0 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </button>)}
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground">{t('commercial.secondModule')}</p>
          <p className="mt-3 text-sm text-muted-foreground">{t('commercial.invitationOnly')}</p>
        </>}

        {selection && currentStep !== 'profile' && <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            {currentStep === 'features' && <>
              {(plans.isPending || catalog.isPending) && <p role="status">{t('commercial.loading')}</p>}
              {(plans.isError || catalog.isError) && <div role="alert" className="rounded-xl border bg-white p-5"><p>{t('commercial.catalogError')}</p><Button variant="outline" className="mt-3" onClick={() => { void plans.refetch(); void catalog.refetch(); }}>{t('commercial.retry')}</Button></div>}
              {selection.profile === 'agency' ? <section className="space-y-4 rounded-2xl border bg-white p-6">
                <h2 className="text-lg font-semibold">{t('commercial.agency.create')}</h2>
                <label className="block space-y-2 text-sm font-medium" htmlFor="signup-agency-name"><span>{t('commercial.agency.name')}</span><input id="signup-agency-name" autoComplete="organization" required maxLength={200} value={selection.agencyName ?? ''} onChange={event => setSelection({ ...selection, agencyName: event.target.value })} className="block min-h-11 w-full rounded-lg border bg-background px-3 text-base" /></label>
                <p className="rounded-xl bg-[#edf2ef] p-4 text-sm">{t('commercial.agency.admin')}</p>
                <h3 className="font-semibold">{t('commercial.agency.title')}</h3>
                <p className="text-sm text-muted-foreground">{t('commercial.agency.explanation')}</p>
                <div className="rounded-xl bg-[#edf2ef] p-4 text-sm">{t('commercial.agency.example')}</div>
                <label className="block space-y-2 text-sm font-medium" htmlFor="signup-rooms"><span>{t('commercial.agency.rooms')}</span><input id="signup-rooms" type="number" min={1} max={10000} step={1} value={selection.rooms} onChange={event => { const value = event.target.valueAsNumber; setSelection({ ...selection, rooms: Number.isInteger(value) ? Math.max(1, Math.min(10000, value)) : 1 }); }} className="block min-h-11 w-32 rounded-lg border bg-background px-3 text-base" /></label>
                {plan && <p className="font-semibold">{priceText(plan)}{t('commercial.perRoomMonth')}</p>}
              </section> : <section className="space-y-3">
                <h2 className="text-lg font-semibold">{t('commercial.choosePlan')}</h2>
                <div className="grid gap-3 sm:grid-cols-3">{(plans.data ?? []).filter(item => item.tier !== 'Agency').map(item => <button type="button" key={item.tier} onClick={() => choosePlan(item.tier)} aria-pressed={item.tier === selection.planTier} className={`min-h-36 rounded-xl border-2 bg-white p-4 text-left ${item.tier === selection.planTier ? 'border-[#1f3a3d]' : 'border-transparent shadow-sm'}`}>
                  <span className="flex items-center justify-between gap-2 font-semibold">{item.displayName}{item.tier === selection.planTier && <Check className="size-4" aria-hidden="true" />}</span>
                  <span className="mt-3 block text-lg font-semibold">{priceText(item)}</span><span className="block text-xs text-muted-foreground">{t('commercial.perMonth')}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">{item.unitAllowance < 0 ? t('commercial.unlimited') : t('commercial.properties', { count: item.unitAllowance })}</span>
                </button>)}</div>
              </section>}
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold"><Check className="size-5" aria-hidden="true" />{t('commercial.included')}</h2>
                <ul className="grid gap-3 text-sm sm:grid-cols-2">{[t(selection.profile === 'long-rent' ? 'commercial.baseLong' : 'commercial.baseShort'), t('commercial.baseCommon'), ...(plan?.features ?? [])].map(feature => <li key={feature} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[#467b67]" aria-hidden="true" />{feature}</li>)}</ul>
              </section>
              <section className="space-y-3">
                <h2 className="flex items-center gap-2 text-lg font-semibold"><Sparkles className="size-5" aria-hidden="true" />{t('commercial.extras')}</h2>
                <p className="text-sm text-muted-foreground">{t('commercial.extrasDescription')}</p>
                {!allowsExtras(selection.planTier) && <p className="flex gap-2 rounded-xl bg-[#efe8dc] p-4 text-sm"><LockKeyhole className="size-4 shrink-0" aria-hidden="true" />{t('commercial.proRequired')}</p>}
                <div className="grid gap-3 sm:grid-cols-2">{addons.map(addon => {
                  const disabled = !allowsExtras(selection.planTier) || !addon.purchasable;
                  return <label key={addon.code} className={`flex gap-3 rounded-xl border bg-white p-5 ${disabled ? 'opacity-70' : 'cursor-pointer hover:border-[#1f3a3d]'} ${selection.addons.includes(addon.code) ? 'ring-1 ring-[#1f3a3d]' : ''}`}>
                    <input type="checkbox" disabled={disabled} checked={selection.addons.includes(addon.code)} onChange={event => setSelection({ ...selection, addons: event.target.checked ? [...selection.addons, addon.code] : selection.addons.filter(code => code !== addon.code) })} className="mt-1 size-4 shrink-0 accent-[#1f3a3d]" />
                    <span className="space-y-1"><span className="block text-sm font-semibold">{t(`commercial.addons.${addon.code}.title`)}</span><span className="block text-xs leading-relaxed text-muted-foreground">{t(`commercial.addons.${addon.code}.text`)}</span><span className="block pt-1 text-xs font-medium">{!addon.purchasable ? t('commercial.unavailable') : addon.priceMonthly === null ? t('commercial.pricePending') : `${money(addon.priceMonthly, addon.currency)}${t(selection.profile === 'agency' ? 'commercial.perRoomMonth' : 'commercial.monthSuffix')}`}</span></span>
                  </label>;
                })}</div>
              </section>
              <div className="flex justify-between gap-3"><Button variant="ghost" onClick={() => setStep('profile')}><ArrowLeft className="size-4" />{t('commercial.back')}</Button><Button onClick={() => setStep('summary')} disabled={!plan || catalog.isPending || catalog.isError || !agencyValid}>{t('commercial.review')}<ArrowRight className="size-4" /></Button></div>
            </>}

            {currentStep === 'summary' && (!consenting ? <section className="space-y-5 rounded-2xl border bg-white p-6">
              <h2 className="text-xl font-semibold">{t('commercial.yourSetup')}</h2>{selection.profile === 'agency' && <p className="font-medium">{selection.agencyName}</p>}
              <dl className="space-y-4 text-sm">{[{ label: t('commercial.labels.profile'), value: t(`commercial.profiles.${selection.profile}.title`) }, { label: t('commercial.labels.area'), value: t(selection.profile === 'long-rent' ? 'commercial.longRent' : 'commercial.shortRent') }, { label: t('commercial.labels.plan'), value: plan?.displayName ?? selection.planTier }].map(({ label, value }) => <div key={label} className="flex flex-wrap justify-between gap-2 border-b pb-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
              {selection.profile === 'agency' && <p>{t('commercial.agency.count', { count: selection.rooms })}</p>}
              <h3 className="font-semibold">{t('commercial.selectedExtras')}</h3>
              {selection.addons.length ? <ul className="space-y-2 text-sm">{selection.addons.map(code => <li key={code} className="flex items-center gap-2"><Check className="size-4" />{t(`commercial.addons.${code}.title`)}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t('commercial.noExtras')}</p>}
              <p className="rounded-xl bg-[#edf2ef] p-4 text-sm">{t('commercial.secondModule')}</p>
              <div className="flex flex-wrap justify-between gap-3"><Button variant="outline" onClick={() => setStep('features')}>{t('commercial.edit')}</Button><Button onClick={() => setConsenting(true)} disabled={!canPay}>{t('commercial.continuePayment')}<ArrowRight className="size-4" /></Button></div>
              {!canPay && <p role="status" className="text-sm text-muted-foreground">{t('commercial.notPurchasable')}</p>}
            </section> : <ConsentsStep key={consentsAttempt} onBack={() => setConsenting(false)} onContinue={payload => void provision(payload)} isLoading={busy} continueLabel={t('commercial.continuePayment')} />)}

            {currentStep === 'payment' && <section className="space-y-5 rounded-2xl border bg-white p-6">
              {pendingPayment ? <div role="status" className="space-y-4"><ShieldCheck className="size-10 text-[#467b67]" aria-hidden="true" /><h2 className="text-lg font-semibold">{t('commercial.paymentPending')}</h2><p className="text-sm text-muted-foreground">{t('commercial.paymentPendingText')}</p><Button variant="outline" onClick={() => void subscription.refetch()}>{t('commercial.checkPayment')}</Button></div> : <>
                {params.get('checkout') === 'cancel' && <p role="status" className="rounded-xl bg-[#efe8dc] p-4 text-sm">{t('commercial.paymentCanceled')}</p>}
                <BillingProfileForm idPrefix="signup" defaultValues={{ billingCountry: subscription.data?.billingCountry ?? '', vatId: subscription.data?.vatId ?? '' }} submitLabel={t('commercial.pay')} pendingLabel={t('commercial.redirecting')} isPending={checkout.isPending || checkout.isSuccess || !!hasSubscription || !canPay} onSubmit={values => {
                  checkout.mutate({ planTier: selection.planTier, commercialSignup: selection, returnPath: '/onboarding', ...toBillingProfileRequest(values) }, { onError: err => setError(getProblemMessage(err, t) ?? t('commercial.failed')) });
                }} />
                {hasSubscription && <Button variant="outline" loading={portal.isPending} onClick={() => portal.mutate()}>{t('commercial.resumePayment')}</Button>}
                {!canPay && <p role="status" className="text-sm text-muted-foreground">{t('commercial.notPurchasable')}</p>}
                <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><LockKeyhole className="size-4 shrink-0" aria-hidden="true" />{t('commercial.stripeNotice')}</p>
              </>}
              {subscription.isError && <p role="alert" className="text-sm text-destructive">{t('commercial.subscriptionError')}</p>}
            </section>}

            {currentStep === 'ready' && <section className="space-y-6 rounded-2xl border bg-white p-7">
              <span className="grid size-14 place-items-center rounded-full bg-[#edf2ef]"><Check className="size-7 text-[#467b67]" aria-hidden="true" /></span>
              <h2 className="text-2xl font-semibold">{t('commercial.readyTitle')}</h2><p className="text-muted-foreground">{t('commercial.readyText')}</p>{selection.profile === 'agency' && <p className="text-sm">{t('commercial.agency.inviteLater')}</p>}
              <Button loading={busy} onClick={() => void enter()}>{t('commercial.enter')}<ArrowRight className="size-4" /></Button>
            </section>}
          </div>
          <aside aria-label={t('commercial.orderSummary')} className={`${currentStep === 'summary' || currentStep === 'payment' ? 'order-first lg:order-last' : ''} space-y-5 rounded-2xl border border-[#1f3a3d]/15 bg-white p-6 shadow-sm lg:sticky lg:top-6`}>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('commercial.orderSummary')}</p>
            <h2 className="text-xl font-semibold">{plan?.displayName ?? selection.planTier}</h2>
            <p className="text-sm text-muted-foreground">{t(selection.profile === 'long-rent' ? 'commercial.longRent' : 'commercial.shortRent')}</p>
            {selection.profile === 'agency' && <p className="rounded-lg bg-[#edf2ef] p-3 text-sm">{t('commercial.agency.count', { count: billingQuantity(selection) })}</p>}
            <ul className="space-y-3 text-sm"><li className="flex justify-between gap-2"><span>{t('commercial.basePlan')}</span><span>{plan && plan.priceMonthly > 0 ? money(plan.priceMonthly * billingQuantity(selection)) : t('commercial.pricePending')}</span></li>{selection.addons.map(code => {
              const addon = addons.find(item => item.code === code);
              return <li key={code} className="flex justify-between gap-2"><span>{t(`commercial.addons.${code}.title`)}</span><span className="shrink-0">{addon?.priceMonthly != null ? money(addon.priceMonthly * billingQuantity(selection), addon.currency) : t('commercial.pricePending')}</span></li>;
            })}</ul>
            <div className="border-t pt-4" aria-live="polite"><p className="text-sm">{t('commercial.total')}</p><p className="mt-2 text-3xl font-semibold">{total === null ? <span className="text-lg">{t('commercial.pricePending')}</span> : money(total)}</p><p className="mt-1 text-xs text-muted-foreground">{t('commercial.taxNote')}</p></div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('commercial.changeLater')}</p>
          </aside>
        </div>}
      </div>
    </main>
  );
}
