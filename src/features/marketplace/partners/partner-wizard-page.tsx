import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Store } from 'lucide-react';
import { z, type ZodType } from 'zod';
import type { FieldValues } from 'react-hook-form';
import { EmptyState } from '@/components/shared/empty-state';
import { WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { writeWizardDraft } from '@/lib/wizard-draft';
import { useDeclarePartner, usePartnerBrief } from '@/queries/use-marketplace';
import { useCurrentUser } from '@/queries/use-users';
import type { MarketplacePartnerActivation } from '@/types';
import { SaveAndExit, WizardFrame } from '../components/wizard-frame';
import { httpsUrlOrNull, parseMarketplaceEntry } from '../lib/marketplace-entry';
import { MARKETPLACE_PATH, MARKETPLACE_PROPERTY_PARAM } from '../lib/marketplace-paths';
import { useWizardLeave, useWizardReturn } from '../lib/use-wizard-exit';
import { openPartnerSite } from './partner-site';
import {
  PARTNER_DRAFT_VERSION,
  PARTNER_STEP,
  declaredDayProblem,
  partnerDefaults,
  partnerWizardId,
  welcomeBackPath,
  type DeclaredDayProblem,
  type PartnerContext,
  type PartnerWizardValues,
} from './partner-wizard-model';
import { HandoffStep } from './steps/handoff-step';
import { PrepareStep } from './steps/prepare-step';
import { PartnerResultStep, WelcomeBackStep } from './steps/welcome-back-step';

type StepSchema = ZodType<unknown, FieldValues>;

const DAY_MESSAGES: Readonly<Record<DeclaredDayProblem, string>> = {
  missing: 'marketplace.partnerFlow.errors.dayMissing',
  invalid: 'marketplace.partnerFlow.errors.dayInvalid',
  future: 'marketplace.partnerFlow.errors.dayFuture',
};

const WELCOME_BACK_SCHEMA: StepSchema = z.object({
  declaredOn: z.string().superRefine((value, context) => {
    const problem = declaredDayProblem(value);
    if (problem) context.addIssue({ code: 'custom', message: DAY_MESSAGES[problem] });
  }),
});

class StepBlockedError extends Error {}

function PartnerWizard({ code }: { code: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { returnTo, exitPath } = useWizardReturn();
  const leave = useWizardLeave(exitPath, t('marketplace.partnerFlow.exit.saved'));
  const { user, org } = useCurrentUser();
  const declare = useDeclarePartner();
  const [failing, setFailing] = useState<'site' | 'declare'>('declare');

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const propertyId = searchParams.get(MARKETPLACE_PROPERTY_PARAM) ?? undefined;
  const briefQuery = usePartnerBrief(code, propertyId);
  const name = briefQuery.data?.name ?? t('marketplace.partnerFlow.thisPartner');

  const context: PartnerContext = {
    code,
    propertyId,
    brief: briefQuery.data,
    briefStatus: briefQuery.isPending ? 'pending' : briefQuery.isError ? 'error' : 'ready',
    briefError: briefQuery.error,
    onRetry: () => void briefQuery.refetch(),
  };

  /**
   * The draft is written with the next step before the page leaves, so that a resume (the draft banner of the wizard) and the browser's Back button both land on
   * «Bentornato». The page does not wait for the draft of the shell, which is written a moment after a change: the step of the draft is what is told here.
   */
  const saveDraftAtWelcomeBack = (values: PartnerWizardValues) => {
    if (!user?.id) return;
    writeWizardDraft(partnerWizardId(code), { userId: user.id, orgId: org?.id ?? null }, { step: PARTNER_STEP.welcomeBack, values: { ...values } }, { version: PARTNER_DRAFT_VERSION });
  };

  const stepsFor = (): WizardStep<PartnerWizardValues>[] => [
    {
      id: PARTNER_STEP.prepare,
      label: t('marketplace.partnerFlow.steps.prepare.label'),
      title: t('marketplace.partnerFlow.steps.prepare.title', { name }),
      purpose: t('marketplace.partnerFlow.steps.prepare.purpose'),
      render: () => <PrepareStep context={context} />,
    },
    {
      id: PARTNER_STEP.handoff,
      label: t('marketplace.partnerFlow.steps.handoff.label'),
      title: t('marketplace.partnerFlow.steps.handoff.title', { name }),
      purpose: t('marketplace.partnerFlow.steps.handoff.purpose'),
      nextLabel: t('marketplace.partnerFlow.handoff.go', { name }),
      nextDisabled: context.briefStatus !== 'ready',
      beforeNext: async (values) => {
        const site = httpsUrlOrNull(briefQuery.data?.websiteUrl);
        if (!site) {
          setFailing('site');
          throw new StepBlockedError('The address of the partner is not an https address');
        }
        saveDraftAtWelcomeBack(values);
        navigate(welcomeBackPath(code, propertyId, returnTo), { replace: true });
        openPartnerSite(site);
        await new Promise<never>(() => undefined);
      },
      render: () => <HandoffStep context={context} />,
    },
    {
      id: PARTNER_STEP.welcomeBack,
      label: t('marketplace.partnerFlow.steps.welcomeBack.label'),
      title: t('marketplace.partnerFlow.steps.welcomeBack.title'),
      purpose: t('marketplace.partnerFlow.steps.welcomeBack.purpose', { name }),
      schema: WELCOME_BACK_SCHEMA,
      render: () => <WelcomeBackStep context={context} />,
    },
  ];

  const onWelcomeBack = searchParams.get('step') === PARTNER_STEP.welcomeBack;

  return (
    <WizardFrame
      title={t('marketplace.partnerFlow.title', { name })}
      description={t('marketplace.partnerFlow.description')}
      testId="partner-wizard-page"
    >
      <WizardShell<PartnerWizardValues, MarketplacePartnerActivation>
        id={partnerWizardId(code)}
        steps={stepsFor()}
        defaultValues={partnerDefaults()}
        draft={{ version: PARTNER_DRAFT_VERSION }}
        finishLabel={t('marketplace.partnerFlow.welcomeBack.yes')}
        finishFailedMessage={failing === 'site' ? t('marketplace.partnerFlow.errors.siteAddress') : t('marketplace.partnerFlow.errors.declareFailed')}
        onFinish={(values) => {
          setFailing('declare');
          return declare.mutateAsync({ code, propertyId, declaredOn: values.declaredOn });
        }}
        onExit={() => navigate(exitPath)}
        aboveFooter={
          <SaveAndExit
            label={t(onWelcomeBack ? 'marketplace.partnerFlow.welcomeBack.notYet' : 'marketplace.partnerFlow.exit.saveAndExit')}
            onLeave={leave}
            testId="partner-save-exit"
          />
        }
        renderDone={({ result }) => <PartnerResultStep context={context} activation={result} exitPath={exitPath} language={i18n.language} />}
        testIds={{
          root: 'partner-wizard',
          back: 'partner-back',
          next: 'partner-next',
          finish: 'partner-finish',
          exit: 'partner-exit',
          finishError: 'partner-finish-error',
        }}
      />
    </WizardFrame>
  );
}

/**
 * `/app/short-rent/marketplace/partners/:code/activate` (E09/F02/US04/T04, MKT-03, S18, Q-006): the hand-off to a Partner Hub partner, whose activation happens on its own
 * site. The wizard prepares everything the partner will ask, opens the partner's site in this tab, welcomes the person back and records the activation as what they
 * declare, with a day. `?propertyId=` is the property the marketplace was about; `?returnTo=` is the page the person came from, where «Salva ed esci» and the end of the
 * wizard lead (the Marketplace page when there is none, or it is not a page of the app): it survives the trip to the partner's site because the hand-off puts it in the
 * address the person comes back to.
 */
export function PartnerWizardPage() {
  const { t } = useTranslation();
  const { code } = useParams();
  const valid = code !== undefined && parseMarketplaceEntry(`Partner:${code}`) !== null;

  if (!valid) {
    return (
      <WizardFrame title={t('marketplace.partnerFlow.titleGeneric')} testId="partner-wizard-page">
        <EmptyState
          icon={Store}
          title={t('marketplace.partnerFlow.notFound.title')}
          description={t('marketplace.partnerFlow.notFound.text')}
          action={{ label: t('marketplace.partnerFlow.backToMarketplace'), href: MARKETPLACE_PATH }}
        />
      </WizardFrame>
    );
  }

  return <PartnerWizard code={code} />;
}
