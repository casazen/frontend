import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Send, Settings2, Share2 } from 'lucide-react';
import type { GeneratedContent } from '@/api/marketing-studio.api';
import { CampaignAssets } from '@/components/campaigns/CampaignAssets';
import { CampaignEditor } from '@/components/campaigns/CampaignEditor';
import { MarketingSettingsForm } from '@/components/campaigns/MarketingSettingsForm';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { CampaignCard } from '@/features/marketing/campaign-card';
import { CAMPAIGN_GOALS, type GoalId } from '@/features/marketing/campaign-goals';
import { CampaignWizard } from '@/features/marketing/campaign-wizard';
import { CampaignArt } from '@/features/marketing/illustrations';
import { IdeasStrip } from '@/features/marketing/ideas-strip';
import { PickCard } from '@/features/marketing/pick-card';
import { useCampaigns } from '@/queries/campaigns';

interface WizardRequest {
  goalId?: GoalId;
  idea?: GeneratedContent;
}

const STARTER_GOALS = CAMPAIGN_GOALS.slice(0, 3);
const EMPTY_STEPS = ['group', 'write', 'approve'] as const;

export function CampaignsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const campaigns = useCampaigns();
  const [wizard, setWizard] = useState<WizardRequest | null>(() => (params.has('new') ? {} : null));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const ideasRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (!params.has('new')) return;
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const showAllIdeas = () => {
    setIdeasOpen(true);
    requestAnimationFrame(() => ideasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  return (
    <div className="min-w-0 space-y-6" data-testid="campaigns-page">
      <PageHeader
        icon={Send}
        title={t('marketingHub.campaigns.title')}
        description={t('marketingHub.campaigns.description')}
        primary={{ label: t('marketingHub.campaigns.create'), icon: Plus, onClick: () => setWizard({}), testId: 'campaigns-create' }}
        secondary={[
          { label: t('marketingHub.campaigns.content'), icon: Share2, onClick: () => setContentOpen(true), testId: 'campaigns-content' },
          { label: t('marketingStudio.settings'), icon: Settings2, onClick: () => setSettingsOpen(true), testId: 'campaigns-settings' },
        ]}
      />

      <IdeasStrip onUse={(idea) => setWizard({ idea })} onSeeAll={showAllIdeas} />

      {campaigns.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-52 rounded-2xl" />
          <Skeleton className="h-52 rounded-2xl" />
        </div>
      ) : null}

      {campaigns.isError ? (
        <ErrorState title={t('campaigns.loadError')} error={campaigns.error} onRetry={() => void campaigns.refetch()} testId="campaigns-error" />
      ) : null}

      {campaigns.data && campaigns.data.length === 0 ? (
        <div className="space-y-8" data-testid="campaigns-empty">
          <section className="overflow-hidden rounded-3xl bg-primary-soft ring-1 ring-inset ring-border">
            <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_15rem]">
              <div className="min-w-0 space-y-4">
                <h2 className="text-balance text-2xl font-semibold tracking-tight">{t('marketingHub.campaigns.empty.title')}</h2>
                <p className="max-w-prose text-foreground/80">{t('marketingHub.campaigns.empty.text')}</p>
                <ol className="space-y-2 text-sm">
                  {EMPTY_STEPS.map((item, index) => (
                    <li key={item} className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-card text-sm font-bold text-primary-text ring-1 ring-inset ring-border">
                        {index + 1}
                      </span>
                      <span className="min-w-0">{t(`marketingHub.campaigns.empty.steps.${item}`)}</span>
                    </li>
                  ))}
                </ol>
                <Button type="button" className="max-md:hidden" onClick={() => setWizard({})} data-testid="campaigns-empty-create">
                  <Plus aria-hidden="true" className="size-4" />
                  {t('marketingHub.campaigns.create')}
                </Button>
              </div>
              <CampaignArt className="hidden w-full md:block" />
            </div>
          </section>
          <section aria-labelledby="starter-goals-title" className="space-y-3">
            <h2 id="starter-goals-title" className="text-lg font-semibold">
              {t('marketingHub.campaigns.empty.starters')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {STARTER_GOALS.map((goal) => (
                <PickCard
                  key={goal.id}
                  icon={goal.icon}
                  tone={goal.tone}
                  title={t(`marketingHub.goals.${goal.id}.title`)}
                  description={t(`marketingHub.goals.${goal.id}.description`)}
                  onPick={() => setWizard({ goalId: goal.id })}
                  testId={`campaign-starter-${goal.id}`}
                />
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {campaigns.data && campaigns.data.length > 0 ? (
        <section aria-labelledby="campaign-list-title" className="space-y-3">
          <h2 id="campaign-list-title" className="text-lg font-semibold">
            {t('marketingHub.campaigns.listTitle')}
          </h2>
          <div className="space-y-3" data-testid="campaign-list">
            {campaigns.data.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        </section>
      ) : null}

      <details
        ref={ideasRef}
        open={ideasOpen}
        onToggle={(event) => setIdeasOpen(event.currentTarget.open)}
        className="rounded-2xl border bg-card p-4 sm:p-5"
        data-testid="campaigns-ideas-view"
      >
        <summary className="cursor-pointer font-semibold">{t('marketingHub.campaigns.viewIdeas')}</summary>
        <div className="mt-4 space-y-4">
          <p className="max-w-prose text-foreground/75">{t('marketingHub.campaigns.ideasIntro')}</p>
          <CampaignAssets />
        </div>
      </details>

      <CampaignWizard
        open={wizard !== null}
        onOpenChange={(open) => {
          if (!open) setWizard(null);
        }}
        initialGoalId={wizard?.goalId}
        initialIdea={wizard?.idea}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('marketingStudio.settings')}</DialogTitle>
            <DialogDescription>{t('marketingStudio.setupIntro')}</DialogDescription>
          </DialogHeader>
          {settingsOpen ? (
            <>
              <MarketingSettingsForm />
              <details className="rounded-xl border bg-card p-4">
                <summary className="cursor-pointer font-semibold">{t('marketingStudio.visibility')}</summary>
                <ol className="mt-3 list-decimal space-y-2 pl-5">
                  {['googlePartner', 'googleInventory', 'siteVisibility'].map((key) => (
                    <li key={key}>{t('marketingStudio.' + key)}</li>
                  ))}
                </ol>
                <Link className="mt-3 block text-primary underline" to="/app/short-rent/vetrina">
                  {t('marketingStudio.storefront')}
                </Link>
              </details>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={contentOpen} onOpenChange={setContentOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('marketingHub.campaigns.content')}</DialogTitle>
            <DialogDescription>{t('marketingHub.campaigns.contentIntro')}</DialogDescription>
          </DialogHeader>
          {contentOpen ? (
            <CampaignEditor
              title={t('marketingHub.campaigns.content')}
              onSaved={() => {
                setContentOpen(false);
                setIdeasOpen(true);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
