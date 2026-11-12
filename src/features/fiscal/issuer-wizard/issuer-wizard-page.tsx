import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/app-shell';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { SkeletonLine } from '@/components/ui/skeleton';
import { FiscalDisclaimer } from '@/features/fiscal/components/fiscal-disclaimer';
import { cn } from '@/lib/utils';
import { useUpdateFiscalTaxProfile } from '@/queries/use-fiscal';
import { useIssuerSettings, useSaveIssuerSettings } from '@/queries/use-fiscal-issuer';
import { useCurrentUser } from '@/queries/use-users';
import type { DocumentIssuerMode, FiscalDocumentSettings, FiscalIssuerField } from '@/types';
import { ApplyIssuerProblems } from './issuer-problems';
import { FISCAL_PATH } from './issuer-paths';
import { IssuerDone } from './issuer-wizard-done';
import { IssuerWizardExit } from './issuer-wizard-exit';
import {
  availabilityOf,
  identityOnRecord,
  initialModeOf,
  isDraftCurrent,
  issuerDefaults,
  issuesOf,
  modeFromValues,
  stepIdsFor,
  taxProfileAddition,
  toSaveRequest,
} from './issuer-wizard-model';
import {
  ISSUER_DRAFT_EXCLUDE,
  ISSUER_DRAFT_VERSION,
  ISSUER_STEPS,
  ISSUER_WIZARD_ID,
  addressStepSchema,
  issuerStepSchema,
  regimeStepSchema,
  whoIssuesSchema,
  type IssuerStepId,
  type IssuerWizardValues,
} from './issuer-wizard-schema';
import { IssuerAddressStep } from './steps/issuer-address-step';
import { IssuerDataStep } from './steps/issuer-data-step';
import { RegimeStep } from './steps/regime-step';
import { SummaryStep } from './steps/summary-step';
import { WhoIssuesStep } from './steps/who-issues-step';

interface IssuerWizardProps {
  settings: FiscalDocumentSettings;
}

/**
 * The wizard once the setting is known (`WizardShell`, like the other guided flows): who issues, the regime, for CasaZen the data and the address
 * of the issuer, and the summary. The steps of the issuer exist only while CasaZen is the choice, so the list of the steps follows the first
 * answer. Every step has «Aiuto» and «Salva ed esci»; nothing is sent to the server until the last button, and the answers are kept as a draft
 * of the tab until then.
 */
function IssuerWizard({ settings }: IssuerWizardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, org } = useCurrentUser();
  const save = useSaveIssuerSettings();
  const updateTaxProfile = useUpdateFiscalTaxProfile();

  // The wizard starts from the setting as it was when the page opened: a later read of it (the window comes back) does not change the answers
  // under the person's hands.
  const [defaults] = useState(() => issuerDefaults(settings, org?.name ?? ''));
  // The first answer decides which steps there are. It is the one the form opens with (the draft the shell will give it, else the setting),
  // and then the one the person gives.
  const [mode, setMode] = useState<DocumentIssuerMode | null>(() => initialModeOf(settings, user?.id ? { userId: user.id, orgId: org?.id ?? null } : null));
  // What the server refused at the last button, shown where it can be fixed.
  const [problems, setProblems] = useState<FiscalIssuerField[]>([]);
  const settle = useCallback((field: FiscalIssuerField) => setProblems((current) => (current.includes(field) ? current.filter((entry) => entry !== field) : current)), []);

  const availability = availabilityOf(settings);
  const onRecord = identityOnRecord(settings);

  /**
   * The last button. The VAT number or the fiscal code the tax profile did not have, and the person wrote, go to the tax profile first (the
   * setting cannot carry them: they live on the organization); then the setting is saved. A refusal that names fields is kept to be shown.
   */
  const finish = async (values: IssuerWizardValues): Promise<FiscalDocumentSettings> => {
    const request = toSaveRequest(values, settings);
    if (!request) throw new Error('The wizard was confirmed without an answer to the first question.');
    setProblems([]);
    try {
      const addition = taxProfileAddition(values, settings);
      if (addition) await updateTaxProfile.mutateAsync(addition);
      return await save.mutateAsync(request);
    } catch (error) {
      setProblems(issuesOf(error));
      throw error;
    }
  };

  const all: Record<IssuerStepId, WizardStep<IssuerWizardValues>> = {
    [ISSUER_STEPS.who]: {
      id: ISSUER_STEPS.who,
      label: t('fiscalDocuments.issuer.steps.who.label'),
      title: t('fiscalDocuments.issuer.steps.who.title'),
      purpose: t('fiscalDocuments.issuer.steps.who.purpose'),
      schema: whoIssuesSchema(availability),
      render: () => <WhoIssuesStep settings={settings} onChoose={setMode} />,
    },
    [ISSUER_STEPS.regime]: {
      id: ISSUER_STEPS.regime,
      label: t('fiscalDocuments.issuer.steps.regime.label'),
      title: t('fiscalDocuments.issuer.steps.regime.title'),
      purpose: t('fiscalDocuments.issuer.steps.regime.purpose'),
      schema: regimeStepSchema,
      render: () => <RegimeStep settings={settings} />,
    },
    [ISSUER_STEPS.issuer]: {
      id: ISSUER_STEPS.issuer,
      label: t('fiscalDocuments.issuer.steps.issuer.label'),
      title: t('fiscalDocuments.issuer.steps.issuer.title'),
      purpose: t('fiscalDocuments.issuer.steps.issuer.purpose'),
      schema: issuerStepSchema(onRecord),
      render: () => <IssuerDataStep settings={settings} onRecord={onRecord} />,
    },
    [ISSUER_STEPS.address]: {
      id: ISSUER_STEPS.address,
      label: t('fiscalDocuments.issuer.steps.address.label'),
      title: t('fiscalDocuments.issuer.steps.address.title'),
      purpose: t('fiscalDocuments.issuer.steps.address.purpose'),
      schema: addressStepSchema,
      render: () => <IssuerAddressStep />,
    },
    [ISSUER_STEPS.summary]: {
      id: ISSUER_STEPS.summary,
      label: t('fiscalDocuments.issuer.steps.summary.label'),
      title: t('fiscalDocuments.issuer.steps.summary.title'),
      purpose: t('fiscalDocuments.issuer.steps.summary.purpose'),
      render: ({ form }) => <SummaryStep settings={settings} values={form.getValues()} problems={problems} />,
    },
  };
  const steps = stepIdsFor(mode).map((id) => all[id]);

  return (
    <WizardShell<IssuerWizardValues, FiscalDocumentSettings>
      id={ISSUER_WIZARD_ID}
      steps={steps}
      defaultValues={defaults}
      // The answers of the tab are used only while they are newer than the last confirmation: nobody's old answers go over a newer setting.
      // The VAT number and the fiscal code are those of the tax profile: they are never kept in the draft.
      draft={{ exclude: ISSUER_DRAFT_EXCLUDE, version: ISSUER_DRAFT_VERSION, accept: (saved) => isDraftCurrent(saved, settings) }}
      // The steps depend on the first answer: the list follows it every time the person lands on a step, whatever way the answer was given.
      onStepChange={({ values }) => setMode(modeFromValues(values))}
      finishLabel={t('fiscalDocuments.issuer.finishLabel')}
      finishFailedMessage={t('fiscalDocuments.issuer.saveFailed')}
      onFinish={finish}
      onExit={() => navigate(FISCAL_PATH)}
      renderDone={() => <IssuerDone />}
      aboveFooter={
        <>
          <ApplyIssuerProblems problems={problems} onSettled={settle} />
          <IssuerWizardExit
            onSaveAndExit={() => {
              toast.success(t('fiscalDocuments.issuer.exit.saved'));
              navigate(FISCAL_PATH);
            }}
          />
        </>
      }
      testIds={{
        root: 'fiscal-issuer-wizard',
        back: 'fiscal-issuer-back',
        next: 'fiscal-issuer-next',
        finish: 'fiscal-issuer-finish',
        exit: 'fiscal-issuer-exit',
        finishError: 'fiscal-issuer-finish-error',
      }}
    />
  );
}

/**
 * «Come emetti i documenti?» (E06/F02/US02/T03, FIS-02, NF-82): who issues the fiscal documents of the organization and which document its
 * regime needs, asked in simple words with an example of the document. The route is `/app/short-rent/fiscal/issuer`, opened from a card of the
 * fiscal page. A failed load is never shown as an empty form.
 */
export function IssuerWizardPage() {
  const { t } = useTranslation();
  const settings = useIssuerSettings();

  return (
    <AppShell>
      <div className={cn(FOCUS_COLUMN, 'space-y-6 md:space-y-8')} data-testid="fiscal-issuer-page">
        <PageHeader title={t('fiscalDocuments.issuer.title')} description={t('fiscalDocuments.issuer.description')} crumbs="auto" />
        {settings.data ? (
          <IssuerWizard settings={settings.data} />
        ) : settings.isError ? (
          <ErrorState
            title={t('fiscalDocuments.issuer.loadError')}
            error={settings.error}
            onRetry={() => void settings.refetch()}
            testId="fiscal-issuer-error"
          />
        ) : (
          <div data-testid="fiscal-issuer-loading">
            <SkeletonLine lines={3} lineClassName="h-10" label={t('fiscalDocuments.issuer.loading')} />
          </div>
        )}
        <FiscalDisclaimer />
      </div>
    </AppShell>
  );
}
