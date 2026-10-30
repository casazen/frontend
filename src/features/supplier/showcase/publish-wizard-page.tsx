import { useRef, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supplierShowcaseApi } from '@/api/supplier-showcase.api';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { WIZARD_DONE_STEP, WizardShell, type WizardStep } from '@/components/shared/wizard/wizard-shell';
import { useSupplierProfile } from '@/queries/supplier/use-profile';
import { usePublishShowcase, useShowcaseContent, useStoreShowcaseContent } from '@/queries/supplier/use-showcase';
import { useSupplierServices } from '@/queries/use-supplier-services';
import type { SupplierService } from '@/types/supplier-services';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { halfFilledRows, OVERVIEW_PATH } from './showcase-model';
import type { DraftPatch } from './use-showcase-draft';
import {
  presentationPatch,
  presentationStepSchema,
  servicesPatch,
  servicesStepSchema,
  stylePatch,
  wizardStart,
  type WizardValues,
} from './wizard/wizard-model';
import { WizardPublished } from './wizard/wizard-published';
import { PresentationStep, ServicesStep, StyleStep, SummaryStep } from './wizard/wizard-steps';

const T = 'supplier.showcase.wizard';

interface WizardBodyProps {
  /** The showcase as the page found it: the wizard starts from its draft and its version. */
  opened: ShowcaseContent;
  services: SupplierService[];
  categories: string[];
}

/**
 * The four steps on the kit of the guided flows (`WizardShell`): the draft is the **server's** (the same as the editor), nothing is kept
 * in the browser. Each "Continua" saves its own part as a merge patch with the version the last answer carried, so a stale one is a 409
 * said in words and nothing is lost silently; the last button publishes, and the toast of an Annulla is not needed here: the
 * confirmation says what happened and the overview undoes it for a few minutes.
 */
function WizardBody({ opened, services, categories }: WizardBodyProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const store = useStoreShowcaseContent();
  const publish = usePublishShowcase();
  // The showcase as the server has it now: every save puts its answer in the cache, the checks of the last step read it.
  const live = useShowcaseContent().data ?? opened;
  const [start] = useState(() => wizardStart(opened.draft, categories, services));

  // What the next save is compared with and sent after: the draft and the version of the last answer.
  const version = useRef(opened.version);
  const draft = useRef(opened.draft);

  const save = async (patch: DraftPatch | null) => {
    if (!patch) return;
    const saved = await supplierShowcaseApi.saveDraft(version.current, patch);
    version.current = saved.version;
    draft.current = saved.draft;
    store(saved);
  };

  const finish = async (): Promise<ShowcaseContent> => {
    const published = await publish.mutateAsync(version.current);
    version.current = published.version;
    draft.current = published.draft;
    return published;
  };

  const activeServices = services.filter((service) => service.status === 'Active').length;
  const text = (id: string) => ({ label: t(`${T}.steps.${id}.label`), title: t(`${T}.steps.${id}.title`), purpose: t(`${T}.steps.${id}.purpose`) });
  const steps: WizardStep<WizardValues>[] = [
    {
      id: 'style',
      ...text('style'),
      beforeNext: (values) => save(stylePatch(values, draft.current, categories)),
      render: () => <StyleStep categories={categories} publicPath={live.publicPath} draft={live.draft} />,
    },
    {
      id: 'presentation',
      ...text('presentation'),
      schema: presentationStepSchema,
      beforeNext: (values) => save(presentationPatch(values, draft.current)),
      render: () => <PresentationStep publicPath={live.publicPath} draft={live.draft} prefilled={start.prefilled} />,
    },
    {
      id: 'services',
      ...text('services'),
      schema: servicesStepSchema,
      // With no active service there is nothing to choose: the step says where to make one.
      nextDisabled: activeServices === 0,
      beforeNext: (values) => save(servicesPatch(values, draft.current, services)),
      render: () => <ServicesStep services={services} />,
    },
    {
      id: 'summary',
      ...text('summary'),
      // The server judges the checks again when it publishes; a button that is off here only saves a refusal.
      nextDisabled: !live.readiness.canPublish || halfFilledRows(live.draft).length > 0,
      render: () => <SummaryStep content={live} services={services} />,
    },
  ];

  return (
    <WizardShell<WizardValues, ShowcaseContent>
      id="supplier-showcase-publish"
      steps={steps}
      defaultValues={start.values}
      finishLabel={t(`${T}.publish`)}
      finishFailedMessage={t(`${T}.failed`)}
      onFinish={finish}
      // The draft is the one of the server: no old draft of the browser can be laid over it.
      draft={false}
      onExit={() => navigate(OVERVIEW_PATH)}
      renderDone={({ result }) => <WizardPublished content={result ?? live} />}
      testIds={{ root: 'supplier-showcase-wizard', finish: 'supplier-showcase-wizard-finish', finishError: 'supplier-showcase-wizard-error' }}
    />
  );
}

/**
 * What the wizard starts from, found once: the showcase as it is when the page opens. A showcase that is already published (or paused,
 * or has changes) is not "to create": its page is the overview, except for the confirmation, which stays open after the publication
 * (and when it is opened again by a reload).
 */
function WizardEntry({ content, services, categories }: { content: ShowcaseContent; services: SupplierService[]; categories: string[] }) {
  const [params] = useSearchParams();
  const [opened] = useState(content);
  const confirmation = params.get('step') === WIZARD_DONE_STEP;
  if (opened.state !== 'Draft' && !confirmation) return <Navigate to={OVERVIEW_PATH} replace />;
  return <WizardBody opened={opened} services={services} categories={categories} />;
}

/**
 * "Crea la tua vetrina" (SP-13e), `/app/supplier/showcase/publish`: the style, two lines of presentation, the services to show and the
 * publication, in four steps. Pressing "Continua" at every step publishes a valid showcase; the page loads what it starts from (the
 * showcase, the catalog and the profile) before the wizard begins, so its first screen already holds the answers.
 */
export function SupplierShowcasePublishWizardPage() {
  const { t } = useTranslation();
  const content = useShowcaseContent();
  const services = useSupplierServices();
  const profile = useSupplierProfile();

  const header = (
    <PageHeader
      title={t(`${T}.title`)}
      description={t(`${T}.description`)}
      crumbs={[{ label: t('supplier.showcase.title'), to: OVERVIEW_PATH }, { label: t(`${T}.title`) }]}
    />
  );

  let body;
  if (content.isError || services.isError || profile.isError) {
    const failed = content.isError ? content : services.isError ? services : profile;
    body = (
      <ErrorState
        testId="supplier-showcase-wizard-load-error"
        title={t(`${T}.loadError`)}
        error={failed.error}
        onRetry={() => void Promise.all([content.refetch(), services.refetch(), profile.refetch()])}
      />
    );
  } else if (!content.data || !services.data || !profile.data) {
    body = <LoadingScreen message={t(`${T}.loading`)} className="h-auto flex-1" />;
  } else {
    body = <WizardEntry content={content.data} services={services.data.items} categories={profile.data.categories ?? []} />;
  }

  return (
    <div className="min-w-0 space-y-6" data-testid="supplier-showcase-wizard-page">
      {header}
      <div className={FOCUS_COLUMN}>{body}</div>
    </div>
  );
}
