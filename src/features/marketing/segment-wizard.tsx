import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarClock, CheckCircle2, Euro, Globe2, Home, Languages, Pencil, Plus, Repeat, Sparkles, Tag, Users, UsersRound, X, type LucideIcon } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import { useProperties } from '@/queries/use-properties';
import { useCreateSegment, usePreviewCondition, useSuggestSegment } from '@/queries/campaigns';
import type { ConditionDefinition, Segment } from '@/types/campaign.types';
import { ConditionCount } from './audience-count';
import { LayerWizard } from './layer-wizard';
import { marketingErrorText } from './marketing-error';
import { PickCard } from './pick-card';
import { recipeText } from './recipe-text';
import { RuleEditor } from './rule-editors';
import { SEGMENT_RECIPES, propertyRecipes, recipeById, type SegmentRecipe } from './segment-recipes';
import {
  FILTER_KINDS,
  conditionOf,
  describeRule,
  emptyCondition,
  isEditable,
  kindOfRule,
  logicOf,
  rulesOf,
  type ConditionRule,
  type FilterKind,
  type GroupLogic,
} from './segment-rules';

type StepId = 'choose' | 'refine' | 'name';

interface Draft {
  name: string;
  condition: ConditionDefinition;
  source: 'recipe' | 'ai' | 'scratch';
}

interface Editing {
  kind: FilterKind;
  index: number | null;
}

export interface SegmentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRecipeId?: string;
  initialBrief?: string;
  onCreated?: (segment: Segment) => void;
  onWriteCampaign?: (segment: Segment) => void;
}

const KIND_ICONS: Record<FilterKind, LucideIcon> = {
  lastStay: CalendarClock,
  stays: Repeat,
  stage: UsersRound,
  properties: Home,
  language: Languages,
  country: Globe2,
  tag: Tag,
  spend: Euro,
};

const AI_EXAMPLES = ['returning', 'recent', 'lost'] as const;

export function SegmentWizard(props: SegmentWizardProps) {
  return props.open ? <SegmentWizardBody {...props} /> : null;
}

function SegmentWizardBody({ onOpenChange, initialRecipeId, initialBrief, onCreated, onWriteCampaign }: SegmentWizardProps) {
  const { t, i18n } = useTranslation();
  const properties = useProperties({ mode: 'short' });
  const propertyList = useMemo(() => (properties.data ?? []).map((property) => ({ id: property.id, name: property.name })), [properties.data]);
  const recipes = useMemo(() => [...SEGMENT_RECIPES, ...propertyRecipes(propertyList)], [propertyList]);

  const initialRecipe = initialRecipeId ? recipeById(initialRecipeId, propertyList) : undefined;
  const [step, setStep] = useState<StepId>(initialRecipe ? 'refine' : 'choose');
  const [draft, setDraft] = useState<Draft>(
    initialRecipe
      ? { name: recipeText(t, initialRecipe).title, condition: initialRecipe.condition, source: 'recipe' }
      : { name: '', condition: emptyCondition(), source: 'scratch' },
  );
  const [brief, setBrief] = useState(initialBrief ?? '');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [created, setCreated] = useState<Segment | null>(null);

  const suggest = useSuggestSegment();
  const create = useCreateSegment();

  const env = {
    t,
    language: i18n.language,
    propertyName: (id: string) => propertyList.find((property) => property.id === id)?.name,
  };
  const rules = rulesOf(draft.condition);
  const logic = logicOf(draft.condition);
  const usedKinds = new Set(rules.map(kindOfRule));
  const freeKinds = FILTER_KINDS.filter((kind) => !usedKinds.has(kind) && (kind !== 'properties' || propertyList.length > 0));

  const stepList = [
    { id: 'choose', label: t('marketingHub.segmentWizard.steps.choose') },
    { id: 'refine', label: t('marketingHub.segmentWizard.steps.refine') },
    { id: 'name', label: t('marketingHub.segmentWizard.steps.name') },
  ];
  const stepIndex = stepList.findIndex((item) => item.id === step);

  const setRules = (next: ConditionRule[], nextLogic: GroupLogic = logic) =>
    setDraft({ ...draft, condition: conditionOf(next, next.length === 0 ? 'AND' : nextLogic) });

  const pickRecipe = (recipe: SegmentRecipe) => {
    setDraft({ name: recipeText(t, recipe).title, condition: recipe.condition, source: 'recipe' });
    setEditing(null);
    setStep('refine');
  };

  const startFromScratch = () => {
    setDraft({ name: '', condition: emptyCondition(), source: 'scratch' });
    setEditing(null);
    setStep('refine');
  };

  const askAi = () => {
    suggest.mutate(brief.trim(), {
      onSuccess: (result) => {
        setDraft({ name: result.name, condition: result.condition, source: 'ai' });
        setEditing(null);
        setStep('refine');
      },
    });
  };

  const saveRule = (rule: ConditionRule) => {
    if (!editing) return;
    const next = editing.index === null ? [...rules, rule] : rules.map((item, index) => (index === editing.index ? rule : item));
    setRules(next);
    setEditing(null);
  };

  const finish = async () => {
    const segment = await create.mutateAsync({ name: draft.name.trim(), condition: draft.condition });
    setCreated(segment);
    onCreated?.(segment);
  };

  if (created) {
    return (
      <LayerWizard
        open
        onOpenChange={onOpenChange}
        icon={UsersRound}
        title={t('marketingHub.segmentWizard.title')}
        steps={stepList}
        stepIndex={2}
        showStepper={false}
        heading={t('marketingHub.segmentWizard.done.title')}
        testId="segment-wizard"
        footer={
          <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-8 sm:py-4">
            <Button type="button" variant={onWriteCampaign ? 'outline' : 'default'} onClick={() => onOpenChange(false)} data-testid="segment-wizard-close">
              {t('marketingHub.segmentWizard.done.close')}
            </Button>
            {onWriteCampaign ? (
              <Button type="button" onClick={() => onWriteCampaign(created)} data-testid="segment-wizard-write">
                {t('marketingHub.segmentWizard.done.write')}
              </Button>
            ) : null}
          </div>
        }
      >
        <div className="flex items-start gap-4 rounded-2xl bg-success-soft p-5 ring-1 ring-inset ring-success-border">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-success-foreground" />
          <div className="min-w-0 space-y-2">
            <p className="break-words text-lg font-semibold">{t('marketingHub.segmentWizard.done.ready', { name: created.name })}</p>
            <p className="text-foreground/80">{t('marketingHub.segmentWizard.done.text')}</p>
            <div className="text-sm font-medium">
              <ConditionCount condition={created.condition} />
            </div>
          </div>
        </div>
      </LayerWizard>
    );
  }

  const heading = t(`marketingHub.segmentWizard.${step}.title`);
  const purpose = t(`marketingHub.segmentWizard.${step}.purpose`);

  return (
    <LayerWizard
      open
      onOpenChange={onOpenChange}
      icon={UsersRound}
      title={t('marketingHub.segmentWizard.title')}
      steps={stepList}
      stepIndex={stepIndex}
      heading={heading}
      purpose={purpose}
      busy={create.isPending || suggest.isPending}
      onStepSelect={(index) => setStep(stepList[index].id as StepId)}
      onBack={step === 'choose' ? undefined : () => setStep(step === 'name' ? 'refine' : 'choose')}
      next={
        step === 'refine'
          ? { label: t('marketingHub.layer.continue'), onClick: () => setStep('name'), disabled: editing !== null }
          : step === 'name'
            ? { label: t('marketingHub.segmentWizard.create'), onClick: () => void finish().catch(() => undefined), disabled: !draft.name.trim(), loading: create.isPending, icon: <CheckCircle2 /> }
            : undefined
      }
      testId="segment-wizard"
    >
      {step === 'choose' ? (
        <div className="space-y-6">
          <section aria-labelledby="segment-ai-title" className="space-y-3 rounded-2xl bg-primary-soft/60 p-4 ring-1 ring-inset ring-border">
            <div className="flex items-center gap-2">
              <Sparkles aria-hidden="true" className="size-5 text-primary-text" />
              <h4 id="segment-ai-title" className="font-semibold">
                {t('marketingHub.segmentWizard.ai.title')}
              </h4>
            </div>
            <Label htmlFor="segment-brief" className="block text-sm font-normal text-foreground/80">
              {t('marketingHub.segmentWizard.ai.label')}
            </Label>
            <Textarea
              id="segment-brief"
              rows={2}
              value={brief}
              maxLength={500}
              placeholder={t('marketingHub.segmentWizard.ai.placeholder')}
              onChange={(event) => setBrief(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              {AI_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setBrief(t(`marketingHub.segmentWizard.ai.examples.${example}`))}
                  className="min-h-9 rounded-full bg-card px-3.5 text-sm ring-1 ring-inset ring-border hover:bg-muted pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t(`marketingHub.segmentWizard.ai.examples.${example}`)}
                </button>
              ))}
            </div>
            {suggest.isError ? <Alert variant="danger">{marketingErrorText(suggest.error, t)}</Alert> : null}
            <Button type="button" variant="default" loading={suggest.isPending} disabled={!brief.trim()} onClick={askAi} data-testid="segment-ai-submit">
              <Sparkles aria-hidden="true" className="size-4" />
              {suggest.isPending ? t('marketingHub.segmentWizard.ai.working') : t('marketingHub.segmentWizard.ai.submit')}
            </Button>
          </section>

          <section aria-labelledby="segment-ready-title" className="space-y-3">
            <h4 id="segment-ready-title" className="font-semibold">
              {t('marketingHub.segmentWizard.ready')}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="segment-recipes">
              {recipes.map((recipe) => {
                const text = recipeText(t, recipe);
                return (
                  <PickCard
                    key={recipe.id}
                    icon={recipe.icon}
                    tone={recipe.tone}
                    title={text.title}
                    description={text.description}
                    footer={<ConditionCount condition={recipe.condition} />}
                    onPick={() => pickRecipe(recipe)}
                    testId={`segment-recipe-${recipe.id}`}
                  />
                );
              })}
            </div>
          </section>

          <Button type="button" variant="ghost" onClick={startFromScratch} data-testid="segment-scratch">
            <Plus aria-hidden="true" className="size-4" />
            {t('marketingHub.segmentWizard.scratch')}
          </Button>
        </div>
      ) : null}

      {step === 'refine' ? (
        <div className="space-y-5">
          {draft.source === 'ai' ? (
            <Alert variant="info" icon={Sparkles}>
              {t('marketingHub.segmentWizard.refine.aiNotice')}
            </Alert>
          ) : null}
          <CountPanel condition={draft.condition} />
          <section aria-labelledby="segment-rules-title" className="space-y-3">
            <h4 id="segment-rules-title" className="font-semibold">
              {t('marketingHub.segmentWizard.refine.rules')}
            </h4>
            {rules.length === 0 ? (
              <p className="rounded-xl bg-muted/50 p-3 text-sm text-foreground/80" data-testid="segment-no-rules">
                {t('marketingHub.segmentWizard.refine.noRules')}
              </p>
            ) : (
              <ul role="list" className="space-y-2" data-testid="segment-rules">
                {rules.map((rule, index) => {
                  const kind = kindOfRule(rule);
                  const Icon = kind ? KIND_ICONS[kind] : Users;
                  const sentence = describeRule(rule, env);
                  return (
                    <li key={`${rule.fieldId}-${index}`}>
                      {editing?.index === index && kind ? (
                        <RuleEditor kind={kind} initial={rule} properties={propertyList} onSave={saveRule} onCancel={() => setEditing(null)} />
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-inset ring-border">
                          <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-text">
                            <Icon className="size-[1.125rem]" />
                          </span>
                          <p className="min-w-0 flex-1 break-words font-medium">{sentence}</p>
                          {kind && isEditable(rule) ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={t('marketingHub.segmentWizard.refine.edit', { rule: sentence })}
                              onClick={() => setEditing({ kind, index })}
                            >
                              <Pencil aria-hidden="true" className="size-4" />
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={t('marketingHub.segmentWizard.refine.remove', { rule: sentence })}
                            onClick={() => {
                              setRules(rules.filter((_, position) => position !== index));
                              setEditing(null);
                            }}
                          >
                            <X aria-hidden="true" className="size-4" />
                          </Button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {editing && editing.index === null ? (
              <RuleEditor kind={editing.kind} properties={propertyList} onSave={saveRule} onCancel={() => setEditing(null)} />
            ) : null}

            {!editing && freeKinds.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground/80">{t('marketingHub.segmentWizard.refine.add')}</p>
                <div className="flex flex-wrap gap-2">
                  {freeKinds.map((kind) => {
                    const Icon = KIND_ICONS[kind];
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setEditing({ kind, index: null })}
                        data-testid={`segment-add-${kind}`}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-card px-3.5 text-sm font-medium ring-1 ring-inset ring-border hover:bg-muted pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Icon aria-hidden="true" className="size-4" />
                        {t(`marketingHub.filters.${kind}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {rules.length > 1 ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground/80">{t('marketingHub.segmentWizard.refine.logicLabel')}</p>
                <Segmented
                  label={t('marketingHub.segmentWizard.refine.logicLabel')}
                  value={logic}
                  onValueChange={(value) => setRules(rules, value)}
                  options={[
                    { value: 'AND', label: t('marketingHub.segmentWizard.refine.all') },
                    { value: 'OR', label: t('marketingHub.segmentWizard.refine.any') },
                  ]}
                />
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {step === 'name' ? (
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="segment-name">{t('marketingHub.segmentWizard.name.label')}</Label>
            <Input
              id="segment-name"
              value={draft.name}
              maxLength={120}
              autoFocus={false}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              data-testid="segment-name"
            />
          </div>
          <div className="space-y-3 rounded-2xl bg-muted/50 p-4 ring-1 ring-inset ring-border">
            <p className="text-sm font-semibold text-foreground/80">{t('marketingHub.segmentWizard.name.summary')}</p>
            {rules.length === 0 ? (
              <p>{t('marketingHub.segmentWizard.refine.noRules')}</p>
            ) : (
              <ul role="list" className="list-disc space-y-1 pl-5">
                {rules.map((rule, index) => (
                  <li key={`${rule.fieldId}-${index}`}>{describeRule(rule, env)}</li>
                ))}
              </ul>
            )}
            <div className="text-sm font-medium">
              <ConditionCount condition={draft.condition} />
            </div>
          </div>
          {create.isError ? <Alert variant="danger">{marketingErrorText(create.error, t, t('marketingHub.errors.segmentSave'))}</Alert> : null}
        </div>
      ) : null}
    </LayerWizard>
  );
}

function CountPanel({ condition }: { condition: ConditionDefinition }) {
  const { t } = useTranslation();
  const settled = useDebouncedValue(condition, 400);
  const preview = usePreviewCondition(settled);
  if (preview.isPending) return <Skeleton className="h-20 w-full rounded-2xl" />;
  if (!preview.data) return null;
  const count = preview.data.count;
  return (
    <div
      role="status"
      data-testid="segment-count"
      className={cn(
        'flex items-center gap-4 rounded-2xl p-4 ring-1 ring-inset',
        count === 0 ? 'bg-warning-soft ring-warning-border' : 'bg-primary-soft ring-border',
      )}
    >
      <span className="text-4xl font-bold tabular-nums tracking-tight">{count}</span>
      <div className="min-w-0">
        <p className="font-semibold">{t('marketingHub.count.reached', { count })}</p>
        <p className="text-sm text-foreground/75">{count === 0 ? t('marketingHub.count.zeroHint') : t('marketingHub.count.consentHint')}</p>
      </div>
    </div>
  );
}
