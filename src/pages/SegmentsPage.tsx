import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Upload, UsersRound } from 'lucide-react';
import { GuestImport } from '@/components/campaigns/GuestImport';
import { PageHeader } from '@/components/layout/page-header';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConditionCount } from '@/features/marketing/audience-count';
import { CampaignWizard } from '@/features/marketing/campaign-wizard';
import { GroupCard } from '@/features/marketing/group-card';
import { GroupsArt } from '@/features/marketing/illustrations';
import { PickCard } from '@/features/marketing/pick-card';
import { recipeText } from '@/features/marketing/recipe-text';
import { SEGMENT_RECIPES, propertyRecipes, type SegmentRecipe } from '@/features/marketing/segment-recipes';
import { SegmentWizard } from '@/features/marketing/segment-wizard';
import { useSegments } from '@/queries/campaigns';
import { useProperties } from '@/queries/use-properties';
import type { Segment } from '@/types/campaign.types';

const FEW_GROUPS = 3;
const EMPTY_STEPS = ['pick', 'check', 'write'] as const;

interface WizardRequest {
  recipeId?: string;
}

export function SegmentsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const segments = useSegments();
  const properties = useProperties({ mode: 'short' });
  const [wizard, setWizard] = useState<WizardRequest | null>(() => (params.has('new') ? {} : null));
  const [importOpen, setImportOpen] = useState(() => params.has('import'));
  const [campaignFor, setCampaignFor] = useState<string | null>(null);

  useEffect(() => {
    if (!params.has('new') && !params.has('import')) return;
    const next = new URLSearchParams(params);
    next.delete('new');
    next.delete('import');
    setParams(next, { replace: true });
  }, [params, setParams]);

  const propertyList = useMemo(() => (properties.data ?? []).map((property) => ({ id: property.id, name: property.name })), [properties.data]);
  const recipes = useMemo(() => [...SEGMENT_RECIPES, ...propertyRecipes(propertyList)], [propertyList]);
  const env = { t, language: i18n.language, propertyName: (id: string) => propertyList.find((property) => property.id === id)?.name };

  const created = segments.data ?? [];
  const missingRecipes = recipes.filter((recipe) => !created.some((segment) => JSON.stringify(segment.condition.groups) === JSON.stringify(recipe.condition.groups)));

  const recipeCard = (recipe: SegmentRecipe) => {
    const text = recipeText(t, recipe);
    return (
      <PickCard
        key={recipe.id}
        icon={recipe.icon}
        tone={recipe.tone}
        title={text.title}
        description={text.description}
        footer={<ConditionCount condition={recipe.condition} />}
        onPick={() => setWizard({ recipeId: recipe.id })}
        testId={`group-recipe-${recipe.id}`}
      />
    );
  };

  return (
    <div className="min-w-0 space-y-6" data-testid="segments-page">
      <PageHeader
        icon={UsersRound}
        title={t('marketingHub.groups.title')}
        description={t('marketingHub.groups.description')}
        primary={{ label: t('marketingHub.groups.create'), icon: Plus, onClick: () => setWizard({}), testId: 'groups-create' }}
        secondary={[{ label: t('marketingHub.groups.import'), icon: Upload, onClick: () => setImportOpen(true), testId: 'groups-import' }]}
      />

      {segments.isPending ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="hidden h-40 rounded-2xl xl:block" />
        </div>
      ) : null}

      {segments.isError ? (
        <ErrorState title={t('campaigns.loadError')} error={segments.error} onRetry={() => void segments.refetch()} testId="groups-error" />
      ) : null}

      {segments.data && created.length === 0 ? (
        <div className="space-y-8" data-testid="groups-empty">
          <section className="overflow-hidden rounded-3xl bg-primary-soft ring-1 ring-inset ring-border">
            <div className="grid items-center gap-6 p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_15rem]">
              <div className="min-w-0 space-y-4">
                <h2 className="text-balance text-2xl font-semibold tracking-tight">{t('marketingHub.groups.empty.title')}</h2>
                <p className="max-w-prose text-foreground/80">{t('marketingHub.groups.empty.text')}</p>
                <ol className="space-y-2 text-sm">
                  {EMPTY_STEPS.map((item, index) => (
                    <li key={item} className="flex items-center gap-3">
                      <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-card text-sm font-bold text-primary-text ring-1 ring-inset ring-border">
                        {index + 1}
                      </span>
                      <span className="min-w-0">{t(`marketingHub.groups.empty.steps.${item}`)}</span>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" className="max-md:hidden" onClick={() => setWizard({})} data-testid="groups-empty-create">
                    <Plus aria-hidden="true" className="size-4" />
                    {t('marketingHub.groups.empty.create')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
                    <Upload aria-hidden="true" className="size-4" />
                    {t('marketingHub.groups.import')}
                  </Button>
                </div>
              </div>
              <GroupsArt className="hidden w-full md:block" />
            </div>
          </section>
          <section aria-labelledby="ready-groups-title" className="space-y-3">
            <h2 id="ready-groups-title" className="text-lg font-semibold">
              {t('marketingHub.groups.empty.ready')}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{recipes.map(recipeCard)}</div>
          </section>
        </div>
      ) : null}

      {created.length > 0 ? (
        <div className="space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="groups-list">
            {created.map((segment) => (
              <GroupCard key={segment.id} segment={segment} env={env} onWrite={(item: Segment) => setCampaignFor(item.id)} />
            ))}
          </div>
          {created.length <= FEW_GROUPS && missingRecipes.length > 0 ? (
            <section aria-labelledby="more-groups-title" className="space-y-3">
              <h2 id="more-groups-title" className="text-lg font-semibold">
                {t('marketingHub.groups.more')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{missingRecipes.slice(0, 3).map(recipeCard)}</div>
            </section>
          ) : null}
        </div>
      ) : null}

      <SegmentWizard
        open={wizard !== null}
        onOpenChange={(open) => {
          if (!open) setWizard(null);
        }}
        initialRecipeId={wizard?.recipeId}
        onWriteCampaign={(segment) => {
          setWizard(null);
          setCampaignFor(segment.id);
        }}
      />
      <CampaignWizard
        open={campaignFor !== null}
        onOpenChange={(open) => {
          if (!open) setCampaignFor(null);
        }}
        initialSegmentId={campaignFor ?? undefined}
      />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t('marketingStudio.importTitle')}</DialogTitle>
            <DialogDescription>{t('marketingHub.groups.importIntro')}</DialogDescription>
          </DialogHeader>
          {importOpen ? <GuestImport /> : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
