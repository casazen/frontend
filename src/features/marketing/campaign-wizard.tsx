import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarSearch, CheckCircle2, ExternalLink, Home, Pencil, Plus, Send, Sparkles } from 'lucide-react';
import { campaignsApi } from '@/api/campaigns.api';
import { assetQueryKey, dismissAsset, marketingStudioApi, saveAssetDraft, type GeneratedContent, type LocalEvent } from '@/api/marketing-studio.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { addDays, todayInRome } from '@/lib/stay-dates';
import { cn } from '@/lib/utils';
import { useSegments } from '@/queries/campaigns';
import { useProperties } from '@/queries/use-properties';
import type { ConditionDefinition, Segment } from '@/types/campaign.types';
import type { Property } from '@/types';
import { ConditionCount, SegmentCount } from './audience-count';
import { CAMPAIGN_GOALS, TONE_STEERS, goalById, type CampaignGoal, type GoalId, type ToneSteer } from './campaign-goals';
import { EMPTY_CAMPAIGN_DRAFT, useCampaignDraftStore, type CampaignDraft } from './campaign-draft-store';
import { EmailPreview } from './email-preview';
import { eventDateText } from './event-date';
import { LayerWizard } from './layer-wizard';
import { marketingErrorText } from './marketing-error';
import { PickCard } from './pick-card';
import { recipeText } from './recipe-text';
import { recipeById } from './segment-recipes';
import { describeRule, rulesOf } from './segment-rules';
import { SegmentWizard } from './segment-wizard';

type StepId = 'goal' | 'audience' | 'event' | 'message' | 'confirm';

interface PropertyOption {
  id: string;
  name: string;
  photoUrl?: string;
}

interface Finished {
  campaignId: string;
  submitted: boolean;
}

export interface CampaignWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSegmentId?: string;
  initialGoalId?: GoalId;
  initialIdea?: GeneratedContent;
}

const RELEVANT_KEYS: ReadonlyArray<keyof CampaignDraft> = ['goalId', 'propertyId', 'segmentId', 'recipeId', 'event'];
const EVENT_PERIODS = [30, 60, 90] as const;

function coverOf(property: Property): string | undefined {
  const absolute = (property.photoUrls ?? []).find((url) => /^https?:\/\//i.test(url));
  return property.coverPhotoUrl ?? absolute;
}

const sameCondition = (a: ConditionDefinition, b: ConditionDefinition) => JSON.stringify(a.groups) === JSON.stringify(b.groups);

const NEXT_STEPS = ['approve', 'schedule', 'results'] as const;

export function CampaignWizard(props: CampaignWizardProps) {
  return props.open ? <CampaignWizardBody {...props} /> : null;
}

function draftOfIdea(idea: GeneratedContent): CampaignDraft {
  return {
    ...EMPTY_CAMPAIGN_DRAFT,
    goalId: idea.sourceEvent ? 'event' : 'custom',
    propertyId: idea.propertyId,
    segmentId: idea.segmentId,
    event: idea.sourceEvent ?? null,
    assetId: idea.id,
    subject: idea.subject,
    body: idea.body,
  };
}

function CampaignWizardBody({ onOpenChange, initialSegmentId, initialGoalId, initialIdea }: CampaignWizardProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const properties = useProperties({ mode: 'short' });
  const segments = useSegments();
  const remembered = useCampaignDraftStore((state) => state.remembered);
  const remember = useCampaignDraftStore((state) => state.remember);
  const forget = useCampaignDraftStore((state) => state.forget);

  const startGoal = goalById(initialGoalId ?? null);
  const [draft, setDraft] = useState<CampaignDraft>(() =>
    initialIdea
      ? draftOfIdea(initialIdea)
      : {
          ...EMPTY_CAMPAIGN_DRAFT,
          segmentId: initialSegmentId ?? '',
          ...(startGoal ? { goalId: startGoal.id, recipeId: initialSegmentId ? null : startGoal.recipeId } : {}),
        },
  );
  const [stepId, setStepId] = useState<StepId>(initialIdea ? 'message' : startGoal ? 'audience' : 'goal');
  const [resumeOffer, setResumeOffer] = useState(Boolean(remembered) && !initialSegmentId && !startGoal && !initialIdea);
  const [groupWizardOpen, setGroupWizardOpen] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [finished, setFinished] = useState<Finished | null>(null);

  const propertyOptions: PropertyOption[] = useMemo(
    () => (properties.data ?? []).map((property) => ({ id: property.id, name: property.name, photoUrl: coverOf(property) })),
    [properties.data],
  );
  const goal = goalById(draft.goalId);
  const propertyId = draft.propertyId || (propertyOptions.length === 1 ? propertyOptions[0].id : '');
  const property = propertyOptions.find((option) => option.id === propertyId);
  const segment = segments.data?.find((item) => item.id === draft.segmentId);

  const ids: StepId[] = goal?.needsEvent ? ['goal', 'audience', 'event', 'message', 'confirm'] : ['goal', 'audience', 'message', 'confirm'];
  const stepList = ids.map((id) => ({ id, label: t(`marketingHub.campaignWizard.steps.${id}`) }));
  const stepIndex = Math.max(0, ids.indexOf(stepId));

  useEffect(() => {
    if (!finished && draft.goalId) remember(draft, stepId);
  }, [draft, stepId, finished, remember]);

  const move = (next: StepId) => setStepId(next);

  const update = (patch: Partial<CampaignDraft>) => {
    const next = { ...draft, ...patch };
    const stale = draft.assetId !== null && RELEVANT_KEYS.some((key) => key in patch && patch[key] !== draft[key]);
    if (stale) {
      void dismissAsset(draft.assetId as string).catch(() => undefined);
      setDraft({ ...next, assetId: null, subject: '', body: '' });
    } else {
      setDraft(next);
    }
  };

  const propertyList = propertyOptions.map(({ id, name }) => ({ id, name }));

  const recommendedFor = (chosen: CampaignGoal): Partial<CampaignDraft> => {
    if (draft.segmentId || !chosen.recipeId) return {};
    const recipe = recipeById(chosen.recipeId, propertyList);
    const existing = recipe ? segments.data?.find((item) => sameCondition(item.condition, recipe.condition)) : undefined;
    return existing ? { segmentId: existing.id, recipeId: null } : { recipeId: chosen.recipeId };
  };

  const pickGoal = (chosen: CampaignGoal) => {
    if (draft.goalId === chosen.id) {
      setDraft({ ...draft, ...recommendedFor(chosen) });
    } else {
      if (draft.assetId !== null) void dismissAsset(draft.assetId).catch(() => undefined);
      setDraft({ ...draft, goalId: chosen.id, event: null, skippedEvent: false, assetId: null, subject: '', body: '', ...recommendedFor(chosen) });
    }
    move('audience');
  };

  const createGroup = useMutation({
    mutationFn: campaignsApi.createSegment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['segments'] }),
  });

  const confirmAudience = async () => {
    let segmentId = draft.segmentId;
    if (!segmentId && draft.recipeId) {
      const recipe = recipeById(draft.recipeId, propertyList);
      if (recipe) {
        const existing = segments.data?.find((item) => sameCondition(item.condition, recipe.condition));
        segmentId = existing ? existing.id : (await createGroup.mutateAsync({ name: recipeText(t, recipe).title, condition: recipe.condition })).id;
      }
    }
    update({ propertyId, segmentId, recipeId: null });
    move(goal?.needsEvent ? 'event' : 'message');
  };

  const finish = useMutation({
    mutationFn: async (submit: boolean): Promise<Finished> => {
      const subject = draft.subject.trim();
      const body = draft.body.trim();
      let campaignId = savedId;
      if (!campaignId) {
        campaignId = draft.assetId
          ? (await saveAssetDraft({ id: draft.assetId, subject, body })).id
          : (await campaignsApi.createDraft({ propertyId, segmentId: draft.segmentId, subject, body })).id;
        setSavedId(campaignId);
      }
      if (submit) await campaignsApi.submitForApproval({ campaignId });
      return { campaignId, submitted: submit };
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      void queryClient.invalidateQueries({ queryKey: assetQueryKey });
      forget();
      setFinished(result);
    },
  });

  const busy = finish.isPending || createGroup.isPending;

  if (finished) {
    return (
      <LayerWizard
        open
        onOpenChange={onOpenChange}
        icon={Send}
        title={t('marketingHub.campaignWizard.title')}
        steps={stepList}
        stepIndex={stepList.length - 1}
        showStepper={false}
        heading={t(finished.submitted ? 'marketingHub.campaignWizard.done.sentTitle' : 'marketingHub.campaignWizard.done.draftTitle')}
        testId="campaign-wizard"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-4">
            <Button type="button" variant={finished.submitted ? 'outline' : 'default'} onClick={() => onOpenChange(false)} data-testid="campaign-wizard-close">
              {t('marketingHub.campaignWizard.done.close')}
            </Button>
            {finished.submitted ? (
              <Button asChild>
                <Link to="/app/short-rent/approval-queue" onClick={() => onOpenChange(false)} data-testid="campaign-wizard-queue">
                  {t('marketingHub.campaignWizard.done.openQueue')}
                </Link>
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex items-start gap-4 rounded-2xl bg-success-soft p-5 ring-1 ring-inset ring-success-border">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-success-foreground" />
            <p className="text-foreground/85">{t(finished.submitted ? 'marketingHub.campaignWizard.done.sentText' : 'marketingHub.campaignWizard.done.draftText')}</p>
          </div>
          {finished.submitted ? (
            <section aria-labelledby="campaign-next-title" className="space-y-3">
              <h4 id="campaign-next-title" className="font-semibold">
                {t('marketingHub.campaignWizard.done.nextTitle')}
              </h4>
              <ol className="space-y-2">
                {NEXT_STEPS.map((item, index) => (
                  <li key={item} className="flex items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-inset ring-border">
                    <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-bold text-primary-text">
                      {index + 1}
                    </span>
                    <span className="min-w-0 text-sm">{t(`marketingHub.campaignWizard.done.next.${item}`)}</span>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>
      </LayerWizard>
    );
  }

  const messageReady = draft.subject.trim().length > 0 && draft.body.trim().length > 0;
  const audienceReady = Boolean(propertyId) && Boolean(draft.segmentId || draft.recipeId);

  const next =
    stepId === 'audience'
      ? { label: t('marketingHub.layer.continue'), onClick: () => void confirmAudience().catch(() => undefined), disabled: !audienceReady, loading: createGroup.isPending }
      : stepId === 'event'
        ? { label: t('marketingHub.layer.continue'), onClick: () => move('message'), disabled: draft.event === null && !draft.skippedEvent }
        : stepId === 'message'
          ? { label: t('marketingHub.layer.continue'), onClick: () => move('confirm'), disabled: !messageReady }
          : stepId === 'confirm'
            ? { label: t('marketingHub.campaignWizard.confirm.send'), onClick: () => finish.mutate(true), loading: finish.isPending, icon: <Send />, disabled: !messageReady || !audienceReady }
            : undefined;

  const back = stepId === 'goal' ? undefined : () => move(ids[Math.max(0, stepIndex - 1)]);

  return (
    <>
      <LayerWizard
        open
        onOpenChange={onOpenChange}
        icon={Send}
        title={t('marketingHub.campaignWizard.title')}
        steps={stepList}
        stepIndex={stepIndex}
        heading={t(`marketingHub.campaignWizard.${stepId}.title`)}
        purpose={t(`marketingHub.campaignWizard.${stepId}.purpose`)}
        busy={busy}
        onBack={back}
        onStepSelect={(index) => move(ids[index])}
        next={next}
        footerExtra={
          stepId === 'confirm' ? (
            <Button type="button" variant="outline" disabled={!messageReady || finish.isPending} onClick={() => finish.mutate(false)} data-testid="campaign-save-draft">
              {t('marketingHub.campaignWizard.confirm.saveDraft')}
            </Button>
          ) : stepId === 'event' ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                update({ skippedEvent: true });
                move('message');
              }}
              data-testid="campaign-skip-event"
            >
              {t('marketingHub.campaignWizard.event.skip')}
            </Button>
          ) : undefined
        }
        testId="campaign-wizard"
      >
        {stepId === 'goal' ? (
          <div className="space-y-5">
            {resumeOffer && remembered ? (
              <Alert
                variant="info"
                title={t('marketingHub.campaignWizard.resume.title')}
                action={
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setDraft(remembered.draft);
                        setStepId(remembered.stepId as StepId);
                        setResumeOffer(false);
                      }}
                      data-testid="campaign-resume"
                    >
                      {t('marketingHub.campaignWizard.resume.resume')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        forget();
                        setResumeOffer(false);
                      }}
                      data-testid="campaign-restart"
                    >
                      {t('marketingHub.campaignWizard.resume.restart')}
                    </Button>
                  </>
                }
              >
                {t('marketingHub.campaignWizard.resume.text')}
              </Alert>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2" data-testid="campaign-goals">
              {CAMPAIGN_GOALS.map((item) => {
                const recipe = item.recipeId ? recipeById(item.recipeId, propertyList) : undefined;
                return (
                  <PickCard
                    key={item.id}
                    icon={item.icon}
                    tone={item.tone}
                    title={t(`marketingHub.goals.${item.id}.title`)}
                    description={t(`marketingHub.goals.${item.id}.description`)}
                    footer={
                      recipe ? (
                        <span className="text-foreground/70">{t('marketingHub.campaignWizard.goal.recommended', { group: recipeText(t, recipe).title })}</span>
                      ) : undefined
                    }
                    onPick={() => pickGoal(item)}
                    testId={`campaign-goal-${item.id}`}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {stepId === 'audience' ? (
          <AudienceStep
            draft={draft}
            goal={goal}
            propertyId={propertyId}
            properties={propertyOptions}
            loadingProperties={properties.isPending}
            propertiesError={properties.isError ? marketingErrorText(properties.error, t) : null}
            segments={segments.data ?? []}
            loadingSegments={segments.isPending}
            onUpdate={update}
            onCreateAnother={() => setGroupWizardOpen(true)}
            error={createGroup.isError ? marketingErrorText(createGroup.error, t, t('marketingHub.errors.segmentSave')) : null}
          />
        ) : null}

        {stepId === 'event' ? <EventStep draft={draft} propertyId={propertyId} onUpdate={update} /> : null}

        {stepId === 'message' && goal ? (
          <MessageStep draft={draft} goal={goal} propertyId={propertyId} property={property} onUpdate={update} onDraftChange={setDraft} />
        ) : null}

        {stepId === 'confirm' && goal ? (
          <ConfirmStep draft={draft} goal={goal} property={property} segment={segment} error={finish.isError ? marketingErrorText(finish.error, t, t('marketingHub.errors.campaignSave')) : null} />
        ) : null}
      </LayerWizard>
      <SegmentWizard
        open={groupWizardOpen}
        onOpenChange={setGroupWizardOpen}
        onCreated={(created: Segment) => update({ segmentId: created.id, recipeId: null })}
      />
    </>
  );
}

interface AudienceStepProps {
  draft: CampaignDraft;
  goal: CampaignGoal | undefined;
  propertyId: string;
  properties: PropertyOption[];
  loadingProperties: boolean;
  propertiesError: string | null;
  segments: Segment[];
  loadingSegments: boolean;
  onUpdate: (patch: Partial<CampaignDraft>) => void;
  onCreateAnother: () => void;
  error: string | null;
}

function AudienceStep({ draft, goal, propertyId, properties, loadingProperties, propertiesError, segments, loadingSegments, onUpdate, onCreateAnother, error }: AudienceStepProps) {
  const { t, i18n } = useTranslation();
  const propertyList = properties.map(({ id, name }) => ({ id, name }));
  const recipe = goal?.recipeId ? recipeById(goal.recipeId, propertyList) : undefined;
  const matching = recipe ? segments.find((item) => sameCondition(item.condition, recipe.condition)) : undefined;
  const selectedSegmentId = draft.segmentId || (matching && draft.recipeId === recipe?.id ? matching.id : '');
  const env = { t, language: i18n.language, propertyName: (id: string) => properties.find((item) => item.id === id)?.name };

  return (
    <div className="space-y-7">
      {propertiesError ? <Alert variant="danger">{propertiesError}</Alert> : null}
      {!propertiesError && !loadingProperties && properties.length === 0 ? (
        <Alert
          variant="warning"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/app/short-rent/properties">{t('marketingHub.campaignWizard.audience.noPropertiesAction')}</Link>
            </Button>
          }
        >
          {t('marketingHub.campaignWizard.audience.noProperties')}
        </Alert>
      ) : null}
      {properties.length > 1 || loadingProperties ? (
        <section aria-labelledby="campaign-property-title" className="space-y-3">
          <h4 id="campaign-property-title" className="font-semibold">
            {t('marketingHub.campaignWizard.audience.property')}
          </h4>
          {loadingProperties ? (
            <Skeleton className="h-24 w-full rounded-xl" />
          ) : (
            <ChoiceGroup legend={t('marketingHub.campaignWizard.audience.property')} minCardWidth={13}>
              {properties.map((item) => (
                <ChoiceCard
                  key={item.id}
                  name="campaign-property"
                  value={item.id}
                  checked={propertyId === item.id}
                  onChange={() => onUpdate({ propertyId: item.id })}
                  title={item.name}
                  media={
                    item.photoUrl ? (
                      <img src={item.photoUrl} alt="" loading="lazy" className="h-24 w-full object-cover" />
                    ) : (
                      <span className="grid h-24 w-full place-items-center bg-muted text-foreground/50">
                        <Home className="size-8" />
                      </span>
                    )
                  }
                  data-testid={`campaign-property-${item.id}`}
                />
              ))}
            </ChoiceGroup>
          )}
        </section>
      ) : null}

      <section aria-labelledby="campaign-group-title" className="space-y-3">
        <h4 id="campaign-group-title" className="font-semibold">
          {t('marketingHub.campaignWizard.audience.group')}
        </h4>
        {loadingSegments ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : (
          <ChoiceGroup legend={t('marketingHub.campaignWizard.audience.group')} minCardWidth={16}>
            {segments.map((item) => {
              const sentences = rulesOf(item.condition).map((rule) => describeRule(rule, env));
              return (
                <ChoiceCard
                  key={item.id}
                  name="campaign-group"
                  value={item.id}
                  checked={selectedSegmentId === item.id}
                  onChange={() => onUpdate({ segmentId: item.id, recipeId: null })}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {item.name}
                      {matching?.id === item.id ? (
                        <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text">{t('marketingHub.campaignWizard.audience.recommended')}</span>
                      ) : null}
                    </span>
                  }
                  description={
                    <span className="block space-y-1">
                      <span className="block">{sentences.length > 0 ? sentences.join(' · ') : t('marketingHub.segmentWizard.refine.noRules')}</span>
                      <span className="block font-medium">
                        <SegmentCount segmentId={item.id} propertyId={propertyId || undefined} />
                      </span>
                    </span>
                  }
                  data-testid={`campaign-group-${item.id}`}
                />
              );
            })}
            {recipe && !matching ? (
              <ChoiceCard
                name="campaign-group"
                value={`recipe:${recipe.id}`}
                checked={!draft.segmentId && draft.recipeId === recipe.id}
                onChange={() => onUpdate({ segmentId: '', recipeId: recipe.id })}
                icon={Sparkles}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {recipeText(t, recipe).title}
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary-text">{t('marketingHub.campaignWizard.audience.recommended')}</span>
                  </span>
                }
                description={
                  <span className="block space-y-1">
                    <span className="block">{t('marketingHub.campaignWizard.audience.createForYou', { description: recipeText(t, recipe).description })}</span>
                    <span className="block font-medium">
                      <ConditionCount condition={recipe.condition} propertyId={propertyId || undefined} />
                    </span>
                  </span>
                }
                data-testid={`campaign-recipe-${recipe.id}`}
              />
            ) : null}
          </ChoiceGroup>
        )}
        <Button type="button" variant="outline" onClick={onCreateAnother} data-testid="campaign-create-group">
          <Plus aria-hidden="true" className="size-4" />
          {t('marketingHub.campaignWizard.audience.createAnother')}
        </Button>
      </section>
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}

function EventStep({ draft, propertyId, onUpdate }: { draft: CampaignDraft; propertyId: string; onUpdate: (patch: Partial<CampaignDraft>) => void }) {
  const { t, i18n } = useTranslation();
  const [days, setDays] = useState<(typeof EVENT_PERIODS)[number]>(60);
  const search = useMutation({
    mutationFn: () => {
      const from = todayInRome();
      return marketingStudioApi.events(propertyId, from, addDays(from, days));
    },
  });

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <Segmented
          label={t('marketingHub.campaignWizard.event.period')}
          value={String(days)}
          onValueChange={(value) => setDays(Number(value) as (typeof EVENT_PERIODS)[number])}
          options={EVENT_PERIODS.map((value) => ({ value: String(value), label: t('marketingHub.campaignWizard.event.days', { count: value }) }))}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => search.mutate()} loading={search.isPending} disabled={!propertyId} data-testid="campaign-event-search">
            <CalendarSearch aria-hidden="true" className="size-4" />
            {search.isPending ? t('marketingHub.campaignWizard.event.searching') : t('marketingHub.campaignWizard.event.search')}
          </Button>
          <p className="text-sm text-foreground/70">{t('marketingHub.campaignWizard.event.hint')}</p>
        </div>
      </div>
      {search.isError ? <Alert variant="danger">{marketingErrorText(search.error, t)}</Alert> : null}
      {search.data && search.data.length === 0 ? <Alert variant="info">{t('marketingHub.campaignWizard.event.none')}</Alert> : null}
      {search.data && search.data.length > 0 ? (
        <ChoiceGroup legend={t('marketingHub.campaignWizard.event.title')} minCardWidth={16}>
          {search.data.map((item: LocalEvent) => (
            <ChoiceCard
              key={`${item.name}-${item.date}`}
              name="campaign-event"
              value={`${item.name}-${item.date}`}
              checked={draft.event?.name === item.name && draft.event?.date === item.date}
              onChange={() => onUpdate({ event: item, skippedEvent: false })}
              title={item.name}
              description={
                <span className="block space-y-1">
                  <span className="block font-medium">{eventDateText(item.date, i18n.language)}</span>
                  <span className="block">{item.description}</span>
                  {/^https?:\/\//i.test(item.source) ? (
                    <a
                      href={item.source}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      className="inline-flex items-center gap-1 text-primary-text underline-offset-4 hover:underline"
                    >
                      {t('marketingStudio.eventSource')}
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  ) : null}
                </span>
              }
              data-testid="campaign-event-choice"
            />
          ))}
        </ChoiceGroup>
      ) : null}
    </div>
  );
}

interface MessageStepProps {
  draft: CampaignDraft;
  goal: CampaignGoal;
  propertyId: string;
  property: PropertyOption | undefined;
  onUpdate: (patch: Partial<CampaignDraft>) => void;
  onDraftChange: (draft: CampaignDraft) => void;
}

function MessageStep({ draft, goal, propertyId, property, onUpdate, onDraftChange }: MessageStepProps) {
  const { t } = useTranslation();
  const [manual, setManual] = useState(false);
  const askDetails = goal.needsDetails || (goal.needsEvent && draft.event === null);
  const hasText = draft.assetId !== null || manual || draft.subject !== '' || draft.body !== '';

  const briefFor = (steer: ToneSteer | null) =>
    [
      t(`marketingHub.goals.${goal.id}.brief`),
      draft.details.trim(),
      draft.event ? t('marketingHub.campaignWizard.message.eventBrief', { name: draft.event.name, date: draft.event.date }) : '',
      steer ? t(`marketingHub.campaignWizard.message.steer.${steer}Brief`) : '',
    ]
      .filter(Boolean)
      .join('\n\n');

  const generate = useMutation({
    mutationFn: (steer: ToneSteer | null) =>
      marketingStudioApi.generate({
        propertyId,
        segmentId: draft.segmentId,
        channel: 'email',
        brief: briefFor(steer),
        eventName: draft.event?.name,
        sourceEvent: draft.event ?? undefined,
      }),
    onSuccess: (result, steer) => {
      if (draft.assetId) void dismissAsset(draft.assetId).catch(() => undefined);
      onDraftChange({ ...draft, assetId: result.id, subject: result.subject, body: result.body, steer });
    },
  });

  const canGenerate = !askDetails || draft.details.trim().length >= 5;

  return (
    <div className="space-y-5">
      {askDetails ? (
        <div className="space-y-1.5">
          <Label htmlFor="campaign-details">{t(`marketingHub.goals.${goal.id}.detailsLabel`)}</Label>
          <Textarea
            id="campaign-details"
            rows={3}
            maxLength={1500}
            value={draft.details}
            placeholder={t(`marketingHub.goals.${goal.id}.detailsPlaceholder`)}
            onChange={(event) => onDraftChange({ ...draft, details: event.target.value })}
            data-testid="campaign-details"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={() => generate.mutate(null)} loading={generate.isPending} disabled={!canGenerate} data-testid="campaign-generate">
          <Sparkles aria-hidden="true" className="size-4" />
          {generate.isPending
            ? t('marketingHub.campaignWizard.message.working')
            : draft.assetId
              ? t('marketingHub.campaignWizard.message.regenerate')
              : t('marketingHub.campaignWizard.message.generate')}
        </Button>
        {!hasText ? (
          <Button type="button" variant="ghost" onClick={() => setManual(true)} data-testid="campaign-manual">
            <Pencil aria-hidden="true" className="size-4" />
            {t('marketingHub.campaignWizard.message.manual')}
          </Button>
        ) : null}
      </div>
      {generate.isError ? (
        <Alert variant="danger" action={<Button type="button" size="sm" variant="outline" onClick={() => setManual(true)}>{t('marketingHub.campaignWizard.message.manual')}</Button>}>
          {marketingErrorText(generate.error, t)}
        </Alert>
      ) : null}
      {generate.isPending ? <Skeleton className="h-40 w-full rounded-2xl" /> : null}

      {hasText && !generate.isPending ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-4">
            {draft.assetId ? (
              <p className="flex items-start gap-2 rounded-xl bg-primary-soft/70 p-3 text-sm">
                <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-text" />
                {t('marketingHub.campaignWizard.message.aiNotice')}
              </p>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="campaign-subject">{t('marketingHub.campaignWizard.message.subject')}</Label>
              <Input id="campaign-subject" value={draft.subject} maxLength={200} onChange={(event) => onUpdate({ subject: event.target.value })} data-testid="campaign-subject" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-body">{t('marketingHub.campaignWizard.message.body')}</Label>
              <Textarea id="campaign-body" rows={9} value={draft.body} onChange={(event) => onUpdate({ body: event.target.value })} data-testid="campaign-body" />
            </div>
            {draft.assetId ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground/80">{t('marketingHub.campaignWizard.message.steerLabel')}</p>
                <div className="flex flex-wrap gap-2">
                  {TONE_STEERS.map((steer) => (
                    <button
                      key={steer}
                      type="button"
                      disabled={generate.isPending}
                      onClick={() => generate.mutate(steer)}
                      className={cn(
                        'min-h-9 rounded-full bg-card px-3.5 text-sm font-medium ring-1 ring-inset ring-border hover:bg-muted pointer-coarse:min-h-11 disabled:opacity-60',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      )}
                    >
                      {t(`marketingHub.campaignWizard.message.steer.${steer}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          <EmailPreview subject={draft.subject} body={draft.body} propertyName={property?.name ?? ''} photoUrl={property?.photoUrl} />
        </div>
      ) : null}
    </div>
  );
}

interface ConfirmStepProps {
  draft: CampaignDraft;
  goal: CampaignGoal;
  property: PropertyOption | undefined;
  segment: Segment | undefined;
  error: string | null;
}

function ConfirmStep({ draft, goal, property, segment, error }: ConfirmStepProps) {
  const { t } = useTranslation();
  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: t('marketingHub.campaignWizard.confirm.goal'), value: t(`marketingHub.goals.${goal.id}.title`) },
    { label: t('marketingHub.campaignWizard.confirm.property'), value: property?.name ?? '—' },
    {
      label: t('marketingHub.campaignWizard.confirm.group'),
      value: (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {segment?.name ?? '—'}
          {segment ? <SegmentCount segmentId={segment.id} propertyId={property?.id} /> : null}
        </span>
      ),
    },
    { label: t('marketingHub.campaignWizard.confirm.subject'), value: draft.subject },
  ];
  return (
    <div className="space-y-5">
      <dl className="divide-y rounded-2xl bg-card ring-1 ring-inset ring-border">
        {rows.map((row) => (
          <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
            <dt className="text-sm text-foreground/70">{row.label}</dt>
            <dd className="min-w-0 break-words font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
      <EmailPreview subject={draft.subject} body={draft.body} propertyName={property?.name ?? ''} photoUrl={property?.photoUrl} />
      <Alert variant="info" title={t('marketingHub.campaignWizard.confirm.afterTitle')}>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('marketingHub.campaignWizard.confirm.after.approve')}</li>
          <li>{t('marketingHub.campaignWizard.confirm.after.limit')}</li>
        </ul>
      </Alert>
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}
