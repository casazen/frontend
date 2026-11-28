import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Store } from 'lucide-react';
import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { EmptyState } from '@/components/shared/empty-state';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { fetchLicensedFunctions, marketplaceLanguage, useMarketplaceEntry, useRequestLicensedFunction } from '@/queries/use-marketplace';
import { useProperties } from '@/queries/use-properties';
import type { MarketplaceFunction } from '@/types';
import { SaveAndExit, WizardFrame } from '../components/wizard-frame';
import { parseMarketplaceEntry } from '../lib/marketplace-entry';
import { MARKETPLACE_PATH, MARKETPLACE_PROPERTY_PARAM } from '../lib/marketplace-paths';
import { draftOfThePropertyOf, useWizardLeave, useWizardReturn } from '../lib/use-wizard-exit';
import {
  LICENSED_DRAFT_VERSION,
  LICENSED_REQUEST_DEFAULTS,
  LICENSED_STEP,
  functionOf,
  licensedProblemOf,
  licensedWizardId,
  requestPhase,
  type LicensedContext,
  type LicensedRequestValues,
} from './licensed-request-model';
import { AskStep } from './steps/ask-step';
import { FunctionStep } from './steps/function-step';
import { LicensedPropertyStep } from './steps/licensed-property-step';
import { RequestedStep } from './steps/requested-step';

type StepSchema = ZodType<unknown, FieldValues>;

const PROPERTY_STEP_SCHEMA: StepSchema = z.object({
  propertyId: z.string().min(1, 'marketplace.licensed.errors.noProperty'),
});

const SHORT_RENT = { mode: 'short' } as const;

class StepBlockedError extends Error {}

function LicensedRequestWizard({ moduleCode }: { moduleCode: string }) {
  const { t, i18n } = useTranslation();
  const language = marketplaceLanguage(i18n.resolvedLanguage ?? i18n.language);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { exitPath } = useWizardReturn();
  const leave = useWizardLeave(exitPath, t('marketplace.licensed.exit.saved'));
  const requestFunction = useRequestLicensedFunction();
  const [alreadyOn, setAlreadyOn] = useState(false);

  const entryQuery = useMarketplaceEntry('LicensedFunction', moduleCode, undefined);
  const propertiesQuery = useProperties(SHORT_RENT);
  const requestedPropertyId = searchParams.get(MARKETPLACE_PROPERTY_PARAM) ?? '';
  const name = entryQuery.data?.name ?? t('marketplace.licensed.thisFunction');

  const context: LicensedContext = {
    moduleCode,
    entry: entryQuery.data,
    entryStatus: entryQuery.isPending ? 'pending' : entryQuery.isError ? 'error' : 'ready',
    properties: propertiesQuery.data ?? [],
    propertiesStatus: propertiesQuery.isPending ? 'pending' : propertiesQuery.isError ? 'error' : 'ready',
    onRetry: () => {
      void entryQuery.refetch();
      void propertiesQuery.refetch();
    },
  };

  const stepsFor = (): WizardStep<LicensedRequestValues>[] => [
    {
      id: LICENSED_STEP.function,
      label: t('marketplace.licensed.steps.function.label'),
      title: t('marketplace.licensed.steps.function.title', { name }),
      purpose: t('marketplace.licensed.steps.function.purpose'),
      render: () => <FunctionStep context={context} />,
    },
    {
      id: LICENSED_STEP.property,
      label: t('marketplace.licensed.steps.property.label'),
      title: t('marketplace.licensed.steps.property.title'),
      purpose: t('marketplace.licensed.steps.property.purpose'),
      schema: PROPERTY_STEP_SCHEMA,
      beforeNext: async (answers) => {
        await fetchLicensedFunctions(queryClient, answers.propertyId, language);
      },
      render: () => <LicensedPropertyStep context={context} />,
    },
    {
      id: LICENSED_STEP.ask,
      label: t('marketplace.licensed.steps.ask.label'),
      title: t('marketplace.licensed.steps.ask.title', { name }),
      purpose: t('marketplace.licensed.steps.ask.purpose'),
      beforeNext: async (answers) => {
        const list = await fetchLicensedFunctions(queryClient, answers.propertyId, language);
        if (requestPhase(functionOf(list, moduleCode)) === 'active') {
          setAlreadyOn(true);
          throw new StepBlockedError('The license shows the function on already');
        }
      },
      render: ({ goTo }) => <AskStep context={context} onChoose={() => goTo(LICENSED_STEP.property)} />,
    },
  ];

  /**
   * «Ho fatto la richiesta»: records that the person asked their channel manager (`POST .../request`), for the property chosen. The function is then Requested, declared by
   * the person, until the license shows it. If the license already shows it on (the server says so: 409) it is told, the list is read again so that the step shows the way
   * back to the Marketplace, and nothing is recorded.
   */
  const recordRequest = async (values: LicensedRequestValues) => {
    try {
      return await requestFunction.mutateAsync({ moduleCode, propertyId: values.propertyId });
    } catch (error) {
      if (licensedProblemOf(error) === 'alreadyActive') {
        setAlreadyOn(true);
        await fetchLicensedFunctions(queryClient, values.propertyId, language).catch(() => undefined);
      }
      throw error;
    }
  };

  return (
    <WizardFrame
      title={t('marketplace.licensed.title', { name })}
      description={t('marketplace.licensed.description')}
      testId="licensed-wizard-page"
    >
      <WizardShell<LicensedRequestValues, MarketplaceFunction>
        id={licensedWizardId(moduleCode)}
        steps={stepsFor()}
        defaultValues={{ ...LICENSED_REQUEST_DEFAULTS, propertyId: requestedPropertyId }}
        draft={{ version: LICENSED_DRAFT_VERSION, accept: draftOfThePropertyOf(requestedPropertyId) }}
        finishLabel={t('marketplace.licensed.ask.finish')}
        finishFailedMessage={alreadyOn ? t('marketplace.licensed.ask.alreadyOn') : t('marketplace.licensed.errors.requestFailed')}
        onFinish={recordRequest}
        onExit={() => navigate(exitPath)}
        aboveFooter={<SaveAndExit label={t('marketplace.licensed.exit.saveAndExit')} onLeave={leave} testId="licensed-save-exit" />}
        renderDone={({ values }) => <RequestedStep context={context} propertyId={values.propertyId || requestedPropertyId} exitPath={exitPath} />}
        testIds={{
          root: 'licensed-wizard',
          back: 'licensed-back',
          next: 'licensed-next',
          finish: 'licensed-finish',
          exit: 'licensed-exit',
          finishError: 'licensed-finish-error',
        }}
      />
    </WizardFrame>
  );
}

export function LicensedRequestWizardPage() {
  const { t } = useTranslation();
  const { moduleCode } = useParams();
  const valid = moduleCode !== undefined && parseMarketplaceEntry(`LicensedFunction:${moduleCode}`) !== null;

  if (!valid) {
    return (
      <WizardFrame title={t('marketplace.licensed.titleGeneric')} testId="licensed-wizard-page">
        <EmptyState
          icon={Store}
          title={t('marketplace.licensed.notFound.title')}
          description={t('marketplace.licensed.notFound.text')}
          action={{ label: t('marketplace.licensed.backToMarketplace'), href: MARKETPLACE_PATH }}
        />
      </WizardFrame>
    );
  }

  return <LicensedRequestWizard moduleCode={moduleCode} />;
}
