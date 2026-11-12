import { useState } from 'react';
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

/** The words of each thing that can be wrong with the day; the messages of a schema are i18n keys, as in every form. */
const DAY_MESSAGES: Readonly<Record<DeclaredDayProblem, string>> = {
  missing: 'marketplace.partnerFlow.errors.dayMissing',
  invalid: 'marketplace.partnerFlow.errors.dayInvalid',
  future: 'marketplace.partnerFlow.errors.dayFuture',
};

/** The day of the activation: a real day, today or earlier in Rome (the server refuses a later one too). */
const WELCOME_BACK_SCHEMA: StepSchema = z.object({
  declaredOn: z.string().superRefine((value, context) => {
    const problem = declaredDayProblem(value);
    if (problem) context.addIssue({ code: 'custom', message: DAY_MESSAGES[problem] });
  }),
});

/** What stops the button that goes to the partner's site: its address is not one that can be opened. */
class StepBlockedError extends Error {}

/**
 * The hand-off wizard of a Partner Hub partner (E09/F02/US04/T04): three steps and the result, on a `WizardShell`. The brief of the partner is read here and handed to the
 * steps; the activation itself happens on the partner's own site, in this tab, and is recorded as what the person declares.
 */
function PartnerWizard({ code }: { code: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { returnTo, exitPath } = useWizardReturn();
  const leave = useWizardLeave(exitPath, t('marketplace.partnerFlow.exit.saved'));
  const { user, org } = useCurrentUser();
  const declare = useDeclarePartner();
  // What a failure that has no message of its own is: the address of the site, or the declaration.
  const [failing, setFailing] = useState<'site' | 'declare'>('declare');

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
      // The one button that leaves: it goes to the partner's address as it is, in this tab, only when it can be opened (https).
      nextLabel: t('marketplace.partnerFlow.handoff.go', { name }),
      nextDisabled: context.briefStatus !== 'ready',
      beforeNext: async (values) => {
        const site = httpsUrlOrNull(briefQuery.data?.websiteUrl);
        if (!site) {
          setFailing('site');
          throw new StepBlockedError('The address of the partner is not an https address');
        }
        saveDraftAtWelcomeBack(values);
        // Before leaving, this history entry becomes the address of the step the person comes back to, with the property and where they came from: the Back
        // button of the browser lands there, and the \`returnTo\` (which lives only in the address) is still in it.
        navigate(welcomeBackPath(code, propertyId, returnTo), { replace: true });
        openPartnerSite(site);
        // The page is leaving: the button waits for the browser, and the wizard does not push the next step on top of the entry that was just replaced.
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
        // «Sì, l'ho completata»: the declaration, for the property of the address (none is the whole organization) and the day the person gave.
        onFinish={(values) => {
          setFailing('declare');
          return declare.mutateAsync({ code, propertyId, declaredOn: values.declaredOn });
        }}
        onExit={() => navigate(exitPath)}
        aboveFooter={
          // «Non ancora» is the way out that keeps the point where the person is: on the step that asks the question it is the wizard's own «Salva ed esci».
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
  // The code ends up in the path of requests: nothing that could carry a path or a query goes through.
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
