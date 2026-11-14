import { useCallback, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { Alert } from '@/components/ui/alert';
import { SkeletonLine } from '@/components/ui/skeleton';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import { useAgencyPlan } from '@/hooks/use-agency-plan';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { ONBOARDING_PLAN_PATH } from '@/lib/onboarding-parts';
import { isOrgBillingAdmin } from '@/lib/org-billing-admin';
import { todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import {
  useApplyMandateTemplate,
  useBillingAccess,
  useBillingPreview,
  useBillingSetup,
  useChannelAccountHolders,
  useChannelCommissionRules,
  useSaveBillingSection,
  useSaveChannelAccountHolders,
  useSaveChannelCommissionRules,
  useSavePortalAccountSettings,
} from '@/queries/use-billing-setup';
import { useUpdateFiscalTaxProfile } from '@/queries/use-fiscal';
import { useProperties } from '@/queries/use-properties';
import { useCurrentUser } from '@/queries/use-users';
import type { BillingSetup } from '@/types';
import { ApplyBillingProblems } from './billing-problems';
import { BillingWizardDone } from './billing-wizard-done';
import { BillingWizardExit } from './billing-wizard-exit';
import { AREA_HOME_PATH, BILLING_STEPS, FISCAL_PATH, type BillingStepId } from './billing-wizard-ids';
import {
  commissionRulesRequest,
  currencyOfCountry,
  firstMissingStep,
  holderChangesRequest,
  identityOnRecord,
  initialValues,
  isNeedsWholeOrg,
  missingItemsOf,
  problemsOf,
  sectionOf,
  stepIdsFor,
  stepSave,
  taxProfileAddition,
  textOf,
  type FormProblem,
} from './billing-wizard-model';
import {
  BILLING_WIZARD_ID,
  channelsStepSchema,
  issuerStepSchema,
  italyStepSchema,
  mandateStepSchema,
  numberingStepSchema,
  touristTaxStepSchema,
  vatStepSchema,
  type BillingWizardValues,
} from './billing-wizard-schema';
import { ChannelsStep } from './steps/channels-step';
import { IssuerStep } from './steps/issuer-step';
import { IssuingStep } from './steps/issuing-step';
import { ItalyStep } from './steps/italy-step';
import { MandateStep } from './steps/mandate-step';
import { NumberingStep } from './steps/numbering-step';
import { StepFrame } from './steps/step-frame';
import { SummaryStep } from './steps/summary-step';
import { TouristTaxStep } from './steps/tourist-tax-step';
import { VatStep } from './steps/vat-step';

/** The name a step has in the texts: the id of the step, with no dash. */
const stepKeyOf = (id: BillingStepId) => (id === BILLING_STEPS.touristTax ? 'touristTax' : id);

interface BillingWizardProps {
  setup: BillingSetup;
  /** The organization is on the agency plan and the person is its administrator: the steps of the portals and of the mandate exist. */
  agency: boolean;
}

/**
 * The wizard once the setup is known (`WizardShell`, like the other guided flows): the steps follow the answers (the Italian step only for an Italian issuer, the steps of the
 * portals and of the mandate only for an agency). Every step has «Aiuto» and «Salva ed esci» and saves on the server with «Continua» (`PUT api/billing-setup/{section}`, a
 * partial payload being a draft), so the answers are not kept in the browser: the setup is the draft, and the wizard reopens at the step that is missing, on any device.
 * A person who may read and not change the setup (no `property.write`, or an access to only some of the properties) sees the same steps with every field switched off, and the
 * reason; nothing is sent for them.
 */
function BillingWizard({ setup, agency }: BillingWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const { flags } = useFeatureFlags();
  const { org } = useCurrentUser();

  const canWrite = hasPermission('short-rent', 'property.write');
  const access = useBillingAccess(canWrite);
  // The reach of the person is learned from the server, before the first step is shown (a person who reaches only some of the properties never sees a field they could fill).
  // A refusal at a save says it too, for a person whose reach changed meanwhile.
  const [refused, setRefused] = useState(false);
  const partialScope = access.data === false || refused;
  const readOnly = !canWrite || partialScope;
  const readOnlyReason = !canWrite ? 'noPermission' : 'partialScope';

  const save = useSaveBillingSection();
  const updateTaxProfile = useUpdateFiscalTaxProfile();
  const savePortalSettings = useSavePortalAccountSettings();
  const saveHolders = useSaveChannelAccountHolders();
  const saveRules = useSaveChannelCommissionRules();
  const apply = useApplyMandateTemplate();
  const preview = useBillingPreview();
  // The listings, the holders and the rules are the agency's: nothing is asked of the server for anyone else.
  const properties = useProperties({ mode: 'short' }, { enabled: agency, fresh: true });
  const holders = useChannelAccountHolders(agency && flags.ownerInvoicing);
  const rules = useChannelCommissionRules(agency);
  // No button of the wizard takes a second press while a request of the person is on its way: the save of a step, the application of the mandate, the way out.
  const [leaving, setLeaving] = useState(false);
  const saving = save.isPending || updateTaxProfile.isPending || savePortalSettings.isPending || saveHolders.isPending || saveRules.isPending || apply.isPending;

  // The wizard starts from the setup as it was when the page opened: a later read of it (the window comes back, a save) does not change the answers under the person's hands.
  const [today] = useState(() => todayInRome());
  const [defaults] = useState(() => initialValues(setup, { organizationName: org?.name ?? '', today }));
  const [problems, setProblems] = useState<FormProblem[]>([]);
  const settle = useCallback((name: string) => setProblems((current) => (current.some((problem) => problem.name === name) ? current.filter((problem) => problem.name !== name) : current)), []);

  const onRecord = identityOnRecord(setup);
  const issuerValues = sectionOf(setup, 'issuer')?.values;
  const ownersWithoutMandate = missingItemsOf(setup).find((item) => item.key === 'owners_without_mandate')?.count ?? 0;
  const year = Number(today.slice(0, 4));
  const home = flags.octorateOnboarding ? { to: ONBOARDING_PLAN_PATH, label: t('billingWizard.done.toPlan') } : { to: FISCAL_PATH, label: t('billingWizard.done.toFiscal') };

  /**
   * Saves what a step holds on the server. A step that was checked sends every field it asks; a draft (what «Salva ed esci» keeps) sends only what is valid and not empty.
   * The VAT number or the fiscal code the tax profile did not have, and the person wrote, go to the tax profile first (the setup cannot carry them: they live on the
   * organization). A refusal that names fields is kept to be shown on them; one that says the person's reach is only some of the properties makes the wizard read-only.
   */
  const saveStep = async (id: BillingStepId, values: BillingWizardValues, draft: boolean): Promise<void> => {
    setProblems([]);
    try {
      if (id === BILLING_STEPS.vat) {
        const addition = taxProfileAddition(values, onRecord, { draft });
        if (addition) await updateTaxProfile.mutateAsync(addition);
      }
      if (id === BILLING_STEPS.channels) {
        if (flags.ownerInvoicing) {
          await savePortalSettings.mutateAsync({ portalAccountHolder: values.portalAccountHolder, rechargePortalCommissions: values.rechargePortalCommissions });
          const rows = holderChangesRequest(values.holderChanges, holders.data ?? []);
          if (rows) await saveHolders.mutateAsync(rows);
        }
        const list = rules.data ? commissionRulesRequest(rules.data, values.commissionPercents, today) : null;
        if (list) await saveRules.mutateAsync(list);
        return;
      }
      const step = stepSave(id, values, { draft, onRecord });
      if (step && Object.keys(step.request).length > 0) await save.mutateAsync(step);
    } catch (error) {
      if (isNeedsWholeOrg(error)) setRefused(true);
      setProblems(problemsOf(error, values.countryCode));
      throw error;
    }
  };

  const saveAndExit = async (values: BillingWizardValues, stepId: string): Promise<boolean> => {
    setLeaving(true);
    try {
      if (!readOnly) {
        try {
          await saveStep(stepId as BillingStepId, values, true);
          toast.success(t('billingWizard.exit.saved'));
        } catch (error) {
          // A person whose reach turned out to be only some of the properties has nothing of theirs to keep: they leave. Any other refusal keeps them here, with what they typed.
          if (!isNeedsWholeOrg(error)) {
            toast.error(getProblemMessage(error, t) ?? t('billingWizard.exit.failed'));
            return false;
          }
        }
      }
      navigate(home.to);
      return true;
    } finally {
      setLeaving(false);
    }
  };

  const frame = (id: BillingStepId, content: ReactNode) => (
    <StepFrame readOnly={readOnly} testId={`billing-step-${id}`}>
      {content}
    </StepFrame>
  );

  const definition = (id: BillingStepId, values: BillingWizardValues): WizardStep<BillingWizardValues> => {
    const key = stepKeyOf(id);
    // A person who may not change the setup reads every step as it is: no check stops them from moving on over data they cannot fix.
    const checked = <T,>(schema: T): T | undefined => (readOnly ? undefined : schema);
    const base = {
      id,
      label: t(`billingWizard.steps.${key}.label`),
      title: t(`billingWizard.steps.${key}.title`),
      purpose: t(`billingWizard.steps.${key}.purpose`),
      beforeNext: readOnly || id === BILLING_STEPS.summary ? undefined : (next: BillingWizardValues) => saveStep(id, next, false),
      nextDisabled: leaving,
    };
    switch (id) {
      case BILLING_STEPS.issuer:
        return { ...base, schema: checked(issuerStepSchema), render: () => frame(id, <IssuerStep />) };
      case BILLING_STEPS.vat:
        return {
          ...base,
          schema: checked(vatStepSchema(onRecord)),
          render: () => frame(id, <VatStep onRecord={onRecord} vatNumber={textOf(issuerValues, 'vatNumber')} fiscalCode={textOf(issuerValues, 'fiscalCode')} />),
        };
      case BILLING_STEPS.numbering:
        return { ...base, schema: checked(numberingStepSchema), render: () => frame(id, <NumberingStep year={year} />) };
      case BILLING_STEPS.touristTax:
        return { ...base, schema: values.countryCode === 'CH' ? checked(touristTaxStepSchema) : undefined, render: () => frame(id, <TouristTaxStep country={values.countryCode} />) };
      case BILLING_STEPS.channels:
        return {
          ...base,
          schema: checked(channelsStepSchema),
          render: () => frame(id, <ChannelsStep ownerInvoicing={flags.ownerInvoicing} properties={properties} holders={holders} rules={rules} />),
        };
      case BILLING_STEPS.mandate:
        return {
          ...base,
          schema: checked(mandateStepSchema),
          nextDisabled: leaving || apply.isPending,
          render: () => frame(id, <MandateStep currency={currencyOfCountry(values.countryCode)} ownersWithoutMandate={ownersWithoutMandate} apply={apply} />),
        };
      case BILLING_STEPS.issuing:
        return { ...base, render: () => frame(id, <IssuingStep />) };
      case BILLING_STEPS.italy:
        return { ...base, schema: checked(italyStepSchema), render: () => frame(id, <ItalyStep />) };
      case BILLING_STEPS.summary:
        return {
          ...base,
          render: ({ form }) => {
            const current = form.getValues();
            return frame(id, <SummaryStep setup={setup} values={current} steps={stepIdsFor(current.countryCode, agency)} preview={preview} />);
          },
        };
    }
  };

  const stepsFor = (values: BillingWizardValues) => stepIdsFor(values.countryCode, agency).map((id) => definition(id, values));
  const openOn = firstMissingStep(setup, stepIdsFor(defaults.countryCode, agency)) ?? BILLING_STEPS.summary;

  // The reach of the person is read before the first step: nobody is offered a field they could not fill, not even for the time of the question.
  if (canWrite && access.isPending) {
    return (
      <div data-testid="billing-access-loading">
        <SkeletonLine lines={3} lineClassName="h-10" label={t('billingWizard.loading')} />
      </div>
    );
  }

  return (
    <>
      {readOnly ? (
        <Alert variant="info" title={t('billingWizard.readOnly.title')} data-testid="billing-read-only">
          {t(`billingWizard.readOnly.${readOnlyReason}`)}
        </Alert>
      ) : null}
      <WizardShell<BillingWizardValues>
        id={BILLING_WIZARD_ID}
        steps={stepsFor(defaults)}
        stepsFor={stepsFor}
        initialStepId={openOn}
        defaultValues={defaults}
        // The answers are on the server, step by step: nothing is kept in the browser, and no old draft of this tab can be laid over what the server has.
        draft={false}
        navigationDisabled={leaving}
        finishLabel={t('billingWizard.finishLabel')}
        finishFailedMessage={t('billingWizard.saveFailed')}
        // Nothing is saved at the last button: every step saved itself. It only closes the wizard, and the confirmation says what the server says is still missing.
        onFinish={() => undefined}
        onExit={() => navigate(home.to)}
        renderDone={() => <BillingWizardDone home={home} />}
        aboveFooter={<ApplyBillingProblems problems={problems} onSettled={settle} />}
        belowFooter={<BillingWizardExit onSaveAndExit={saveAndExit} disabled={saving} />}
        testIds={{
          root: 'fiscal-billing-wizard',
          back: 'fiscal-billing-back',
          next: 'fiscal-billing-next',
          finish: 'fiscal-billing-finish',
          exit: 'fiscal-billing-exit',
          finishError: 'fiscal-billing-finish-error',
        }}
      />
    </>
  );
}

/** The wizard for an agency's administrator: whether the organization is on the agency plan is read first (it decides the steps), and a plan that cannot be read is told as such. */
function BillingWizardWithPlan({ setup }: { setup: BillingSetup }) {
  const { t } = useTranslation();
  const plan = useAgencyPlan();
  if (plan.isLoading) return <SkeletonLine lines={3} lineClassName="h-10" label={t('billingWizard.loading')} />;
  if (plan.failed) return <ErrorState title={t('agencyFinance.planError')} onRetry={plan.retry} testId="billing-plan-error" />;
  return <BillingWizard setup={setup} agency={plan.isAgency} />;
}

/** Decides whether the plan is asked: it is read from an endpoint of the administrator of the organization, which anyone else would be refused, so nobody else asks it. */
function BillingWizardLoaded({ setup }: { setup: BillingSetup }) {
  const { contexts } = useWorkspace();
  const { flags } = useFeatureFlags();
  if (isOrgBillingAdmin(contexts) && flags.agencyTier) return <BillingWizardWithPlan setup={setup} />;
  return <BillingWizard setup={setup} agency={false} />;
}

/**
 * The wizard «Fatturazione» (E11/F02/US01/T01, NF-82, NF-118): the whole invoicing setup of the organization in one guided flow, a part of the onboarding guide: who issues (CasaZen,
 * always, in the name of the organization), the VAT, the numbering, the tourist tax, for an agency the commissions of the portals and the standard mandate, the issuing, for an
 * Italian issuer the reminders, and the summary with the rates in force. The route is `/app/short-rent/fiscal/setup` and `?step=` carries the step; the old
 * `/app/short-rent/fiscal/issuer` leads here. With the issuance of fiscal documents off the route leads to the home of the area. A failed load is never shown as an empty form.
 */
export function BillingWizardPage() {
  const { t } = useTranslation();
  const setup = useBillingSetup();
  // A 404 is a setup that is not there (the issuance is off): it is that even when the query still holds the answer it had, which it keeps when a later read fails.
  const notFound = setup.isError && getHttpStatus(setup.error) === 404;

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6 md:space-y-8')} data-testid="fiscal-billing-page">
        <PageHeader title={t('billingWizard.title')} description={t('billingWizard.description')} crumbs="auto" />
        {notFound ? (
          <Navigate to={AREA_HOME_PATH} replace />
        ) : setup.data ? (
          // A read that fails after the wizard is open (a transient error when the window comes back) does not take the form from under the person's hands.
          <BillingWizardLoaded setup={setup.data} />
        ) : setup.isError ? (
          <ErrorState title={t('billingWizard.loadError')} error={setup.error} onRetry={() => void setup.refetch()} testId="fiscal-billing-error" />
        ) : (
          <div data-testid="fiscal-billing-loading">
            <SkeletonLine lines={3} lineClassName="h-10" label={t('billingWizard.loading')} />
          </div>
        )}
        <FiscalDisclaimer />
      </div>
    </AppShell>
  );
}
