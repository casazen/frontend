import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ChevronDown, Home, Newspaper, Pencil, Plus, Sparkles, Undo2 } from 'lucide-react';
import type { NewsletterSettings } from '@/api/marketing-studio.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { Segment } from '@/types/campaign.types';
import { SegmentCount } from './audience-count';
import { PropertyChoice } from './property-choice';
import type { PropertyOption } from './property-options';
import {
  CADENCE_CHOICES,
  CADENCE_KEYS,
  LOST_MONTHS_CHOICES,
  LOYAL_STAYS_CHOICES,
  MONTHLY_LIMITS,
  NEWSLETTER_TOPICS,
  VOICE_STYLES,
  isPublicHttpsUrl,
  withCurrent,
} from './settings-rules';
import { ToneTile } from './tone-tile';

export interface VoiceHelp {
  examples: string;
  website: string;
}

const base = 'marketingHub.settingsWizard';
const VISIBILITY_TIPS = ['googlePartner', 'googleInventory', 'siteVisibility'] as const;

interface VoiceStepProps {
  voice: string;
  fromAi: boolean;
  canUndo: boolean;
  help: VoiceHelp;
  onHelp: (help: VoiceHelp) => void;
  proposing: boolean;
  error: string | null;
  onVoice: (value: string) => void;
  onPreset: (text: string) => void;
  onPropose: () => void;
  onUndo: () => void;
}

export function VoiceStep({ voice, fromAi, canUndo, help, onHelp, proposing, error, onVoice, onPreset, onPropose, onUndo }: VoiceStepProps) {
  const { t } = useTranslation();
  const websiteProblem = help.website.trim() !== '' && !isPublicHttpsUrl(help.website);
  const canPropose = (help.examples.trim() !== '' || help.website.trim() !== '') && !websiteProblem;

  return (
    <div className="space-y-6">
      <div>
        <ChoiceGroup legend={t(`${base}.voice.presetsLabel`)} legendVisible minCardWidth={16}>
          {VOICE_STYLES.map((style) => {
            const text = t(`${base}.voice.styles.${style.id}.text`);
            return (
              <ChoiceCard
                key={style.id}
                name="voice-style"
                value={style.id}
                checked={voice === text}
                onChange={() => onPreset(text)}
                disabled={proposing}
                icon={style.icon}
                title={t(`${base}.voice.styles.${style.id}.title`)}
                description={t(`${base}.voice.styles.${style.id}.description`)}
                data-testid={`voice-style-${style.id}`}
              />
            );
          })}
        </ChoiceGroup>
      </div>

      <section aria-labelledby="voice-ai-title" className="space-y-3 rounded-2xl bg-primary-soft/60 p-4 ring-1 ring-inset ring-border">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden="true" className="size-5 text-primary-text" />
          <h4 id="voice-ai-title" className="font-semibold">
            {t(`${base}.voice.ai.title`)}
          </h4>
        </div>
        <p className="text-sm text-foreground/80">{t(`${base}.voice.ai.text`)}</p>
        <Field label={t(`${base}.voice.ai.examples`)}>
          <Textarea
            rows={3}
            maxLength={8000}
            value={help.examples}
            placeholder={t(`${base}.voice.ai.examplesPlaceholder`)}
            onChange={(event) => onHelp({ ...help, examples: event.target.value })}
            data-testid="voice-examples"
          />
        </Field>
        <Field label={t(`${base}.voice.ai.website`)} error={websiteProblem ? t(`${base}.voice.ai.websiteInvalid`) : undefined}>
          <Input
            type="url"
            inputMode="url"
            value={help.website}
            placeholder={t(`${base}.voice.ai.websitePlaceholder`)}
            onChange={(event) => onHelp({ ...help, website: event.target.value })}
            data-testid="voice-website"
          />
        </Field>
        {error ? <Alert variant="danger">{error}</Alert> : null}
        <Button type="button" loading={proposing} disabled={!canPropose} onClick={onPropose} data-testid="voice-propose">
          <Sparkles aria-hidden="true" className="size-4" />
          {proposing ? t(`${base}.voice.ai.working`) : t(`${base}.voice.ai.submit`)}
        </Button>
      </section>

      <section className="space-y-2">
        <Field label={t(`${base}.voice.label`)} hint={voice.trim() === '' ? t(`${base}.voice.emptyHint`) : t(`${base}.voice.hint`)}>
          <Textarea rows={6} maxLength={8000} value={voice} disabled={proposing} onChange={(event) => onVoice(event.target.value)} data-testid="voice-text" />
        </Field>
        {fromAi ? (
          <Alert variant="info" icon={Sparkles}>
            {t(`${base}.voice.ai.notice`)}
          </Alert>
        ) : null}
        {canUndo ? (
          <Button type="button" variant="ghost" size="sm" onClick={onUndo} data-testid="voice-undo">
            <Undo2 aria-hidden="true" className="size-4" />
            {t(`${base}.voice.undo`)}
          </Button>
        ) : null}
      </section>
    </div>
  );
}

interface HousesStepProps {
  properties: PropertyOption[];
  loading: boolean;
  error: string | null;
  notes: Record<string, string>;
  urls: Record<string, string>;
  onNote: (id: string, value: string) => void;
  onUrl: (id: string, value: string) => void;
}

function Chip({ children }: { children: string }) {
  return <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary-text">{children}</span>;
}

export function HousesStep({ properties, loading, error, notes, urls, onNote, onUrl }: HousesStepProps) {
  const { t } = useTranslation();

  if (loading) return <Skeleton className="h-24 w-full rounded-2xl" />;
  if (error) return <Alert variant="danger">{error}</Alert>;
  if (properties.length === 0) return <p className="rounded-xl bg-muted/50 p-4 text-foreground/80">{t(`${base}.houses.none`)}</p>;

  return (
    <ul role="list" className="space-y-3" data-testid="settings-houses">
      {properties.map((property) => {
        const url = urls[property.id] ?? '';
        const note = notes[property.id] ?? '';
        const urlProblem = url.trim() !== '' && !isPublicHttpsUrl(url);
        return (
          <li key={property.id}>
            <details open={properties.length === 1 || urlProblem} className="group rounded-2xl bg-card ring-1 ring-inset ring-border" data-testid={`settings-house-${property.id}`}>
              <summary className="flex cursor-pointer list-none items-center gap-3 p-3 pr-4 [&::-webkit-details-marker]:hidden">
                {property.photoUrl ? (
                  <img src={property.photoUrl} alt="" loading="lazy" className="size-12 shrink-0 rounded-lg object-cover" />
                ) : (
                  <ToneTile icon={Home} tone="neutral" className="[--cz-icon-tile-size:3rem]" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{property.name}</span>
                  <span className="flex flex-wrap gap-1.5 pt-1">
                    {url.trim() ? <Chip>{t(`${base}.houses.hasSite`)}</Chip> : null}
                    {note.trim() ? <Chip>{t(`${base}.houses.hasNotes`)}</Chip> : null}
                    {!url.trim() && !note.trim() ? <span className="text-sm text-foreground/60">{t(`${base}.houses.empty`)}</span> : null}
                  </span>
                </span>
                <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-foreground/60 transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-4 border-t p-4 md:grid-cols-2">
                <Field label={t(`${base}.houses.site`)} error={urlProblem ? t(`${base}.houses.siteInvalid`) : undefined}>
                  <Input
                    type="url"
                    inputMode="url"
                    value={url}
                    placeholder={t(`${base}.houses.sitePlaceholder`)}
                    onChange={(event) => onUrl(property.id, event.target.value)}
                    data-testid={`settings-site-${property.id}`}
                  />
                </Field>
                <Field label={t(`${base}.houses.notes`)}>
                  <Textarea
                    rows={3}
                    maxLength={4000}
                    value={note}
                    placeholder={t(`${base}.houses.notesPlaceholder`)}
                    onChange={(event) => onNote(property.id, event.target.value)}
                    data-testid={`settings-notes-${property.id}`}
                  />
                </Field>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

interface RulesStepProps {
  limit: number;
  loyalStays: number;
  lostMonths: number;
  onLimit: (value: number) => void;
  onLoyalStays: (value: number) => void;
  onLostMonths: (value: number) => void;
}

export function RulesStep({ limit, loyalStays, lostMonths, onLimit, onLoyalStays, onLostMonths }: RulesStepProps) {
  const { t } = useTranslation();
  const stays = withCurrent(LOYAL_STAYS_CHOICES, loyalStays);
  const months = withCurrent(LOST_MONTHS_CHOICES, lostMonths);

  return (
    <div className="space-y-7">
      <section aria-labelledby="rules-limit-title" className="space-y-3">
        <h4 id="rules-limit-title" className="font-semibold">
          {t(`${base}.rules.limit.title`)}
        </h4>
        <div>
          <ChoiceGroup legend={t(`${base}.rules.limit.title`)} minCardWidth={12}>
            {MONTHLY_LIMITS.map((value) => (
              <ChoiceCard
                key={value}
                name="settings-limit"
                value={String(value)}
                checked={limit === value}
                onChange={() => onLimit(value)}
                title={t(`${base}.rules.limit.options.${value}.title`)}
                description={t(`${base}.rules.limit.options.${value}.description`)}
                data-testid={`settings-limit-${value}`}
              />
            ))}
          </ChoiceGroup>
        </div>
        {limit === 0 ? (
          <Alert variant="warning" data-testid="settings-limit-paused">
            {t(`${base}.rules.limit.paused`)}
          </Alert>
        ) : null}
      </section>

      <section aria-labelledby="rules-loyal-title" className="space-y-2">
        <h4 id="rules-loyal-title" className="font-semibold">
          {t(`${base}.rules.loyal.title`)}
        </h4>
        <Segmented
          label={t(`${base}.rules.loyal.title`)}
          className="flex-wrap"
          value={String(loyalStays)}
          onValueChange={(value) => onLoyalStays(Number(value))}
          options={stays.map((value) => ({ value: String(value), label: t(`${base}.rules.loyal.option`, { count: value }), testId: `settings-loyal-${value}` }))}
        />
        <p className="text-sm text-foreground/70">{t(`${base}.rules.loyal.hint`)}</p>
      </section>

      <section aria-labelledby="rules-lost-title" className="space-y-2">
        <h4 id="rules-lost-title" className="font-semibold">
          {t(`${base}.rules.lost.title`)}
        </h4>
        <Segmented
          label={t(`${base}.rules.lost.title`)}
          className="flex-wrap"
          value={String(lostMonths)}
          onValueChange={(value) => onLostMonths(Number(value))}
          options={months.map((value) => ({ value: String(value), label: t(`${base}.rules.lost.option`, { count: value }), testId: `settings-lost-${value}` }))}
        />
        <p className="text-sm text-foreground/70">{t(`${base}.rules.lost.hint`)}</p>
      </section>
    </div>
  );
}

interface NewsletterStepProps {
  plan: NewsletterSettings;
  properties: PropertyOption[];
  propertyId: string;
  segments: Segment[];
  loadingSegments: boolean;
  onChange: (patch: Partial<NewsletterSettings>) => void;
  onTopic: (line: string) => void;
  onCreateGroup: () => void;
}

export function NewsletterStep({ plan, properties, propertyId, segments, loadingSegments, onChange, onTopic, onCreateGroup }: NewsletterStepProps) {
  const { t } = useTranslation();
  const cadences = withCurrent(CADENCE_CHOICES, plan.cadenceDays);
  const cadenceLabel = (days: number) =>
    days in CADENCE_KEYS ? t(`${base}.newsletter.cadenceOptions.${CADENCE_KEYS[days as keyof typeof CADENCE_KEYS]}`) : t(`${base}.newsletter.cadenceCustom`, { count: days });
  const incomplete = plan.enabled && (!propertyId || !plan.segmentId);

  return (
    <div className="space-y-6">
      <div>
        <ChoiceGroup legend={t(`${base}.newsletter.title`)} minCardWidth={14}>
          <ChoiceCard
            name="settings-newsletter"
            value="off"
            checked={!plan.enabled}
            onChange={() => onChange({ enabled: false })}
            title={t(`${base}.newsletter.off.title`)}
            description={t(`${base}.newsletter.off.description`)}
            data-testid="settings-newsletter-off"
          />
          <ChoiceCard
            name="settings-newsletter"
            value="on"
            checked={plan.enabled}
            onChange={() => onChange({ enabled: true })}
            icon={Newspaper}
            title={t(`${base}.newsletter.on.title`)}
            description={t(`${base}.newsletter.on.description`)}
            data-testid="settings-newsletter-on"
          />
        </ChoiceGroup>
      </div>

      {plan.enabled ? (
        <div className="space-y-6" data-testid="settings-newsletter-details">
          {properties.length > 1 ? (
            <section aria-labelledby="newsletter-property-title" className="space-y-3">
              <h4 id="newsletter-property-title" className="font-semibold">
                {t(`${base}.newsletter.property`)}
              </h4>
              <PropertyChoice
                legend={t(`${base}.newsletter.property`)}
                name="newsletter-property"
                options={properties}
                value={propertyId}
                onChange={(id) => onChange({ propertyId: id })}
                testIdPrefix="newsletter-property"
              />
            </section>
          ) : null}

          <section aria-labelledby="newsletter-group-title" className="space-y-3">
            <h4 id="newsletter-group-title" className="font-semibold">
              {t(`${base}.newsletter.group`)}
            </h4>
            {loadingSegments ? <Skeleton className="h-20 w-full rounded-xl" /> : null}
            {!loadingSegments && segments.length === 0 ? <Alert variant="info">{t(`${base}.newsletter.noGroups`)}</Alert> : null}
            {segments.length > 0 ? (
              <div>
                <ChoiceGroup legend={t(`${base}.newsletter.group`)} minCardWidth={14}>
                  {segments.map((segment) => (
                    <ChoiceCard
                      key={segment.id}
                      name="newsletter-group"
                      value={segment.id}
                      checked={plan.segmentId === segment.id}
                      onChange={() => onChange({ segmentId: segment.id })}
                      title={segment.name}
                      description={<SegmentCount segmentId={segment.id} propertyId={propertyId || undefined} />}
                      data-testid={`newsletter-group-${segment.id}`}
                    />
                  ))}
                </ChoiceGroup>
              </div>
            ) : null}
            <Button type="button" variant="outline" onClick={onCreateGroup} data-testid="newsletter-create-group">
              <Plus aria-hidden="true" className="size-4" />
              {t(`${base}.newsletter.createGroup`)}
            </Button>
          </section>

          <section aria-labelledby="newsletter-cadence-title" className="space-y-2">
            <h4 id="newsletter-cadence-title" className="font-semibold">
              {t(`${base}.newsletter.cadence`)}
            </h4>
            <Segmented
              label={t(`${base}.newsletter.cadence`)}
              className="flex-wrap"
              value={String(plan.cadenceDays)}
              onValueChange={(value) => onChange({ cadenceDays: Number(value) })}
              options={cadences.map((value) => ({ value: String(value), label: cadenceLabel(value), testId: `newsletter-cadence-${value}` }))}
            />
          </section>

          <section aria-labelledby="newsletter-topics-title" className="space-y-3">
            <Field label={t(`${base}.newsletter.instructions`)} hint={t(`${base}.newsletter.instructionsHint`)}>
              <Textarea rows={4} maxLength={4000} value={plan.instructions ?? ''} onChange={(event) => onChange({ instructions: event.target.value })} data-testid="newsletter-instructions" />
            </Field>
            <div className="flex flex-wrap gap-2">
              <span id="newsletter-topics-title" className="sr-only">
                {t(`${base}.newsletter.topicsLabel`)}
              </span>
              {NEWSLETTER_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => onTopic(t(`${base}.newsletter.topics.${topic}.text`))}
                  data-testid={`newsletter-topic-${topic}`}
                  className={cn(
                    'min-h-9 rounded-full bg-card px-3.5 text-sm ring-1 ring-inset ring-border hover:bg-muted pointer-coarse:min-h-11',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  )}
                >
                  {t(`${base}.newsletter.topics.${topic}.label`)}
                </button>
              ))}
            </div>
          </section>

          {incomplete ? <p className="text-sm text-foreground/75">{t(`${base}.newsletter.incomplete`)}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export interface ReviewRow {
  id: string;
  label: string;
  value: string;
  onChange: () => void;
}

export function ReviewStep({ rows, error }: { rows: readonly ReviewRow[]; error: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <ul role="list" className="divide-y rounded-2xl bg-card ring-1 ring-inset ring-border" data-testid="settings-review">
        {rows.map((row) => (
          <li key={row.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
            <p className="text-sm text-foreground/70">{row.label}</p>
            <p className="min-w-0 whitespace-pre-line break-words font-medium">{row.value}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start sm:justify-self-end"
              onClick={row.onChange}
              aria-label={`${t(`${base}.review.change`)}: ${row.label}`}
              data-testid={`settings-change-${row.id}`}
            >
              <Pencil aria-hidden="true" className="size-4" />
              {t(`${base}.review.change`)}
            </Button>
          </li>
        ))}
      </ul>
      {error ? <Alert variant="danger">{error}</Alert> : null}
    </div>
  );
}

export function SettingsDone() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5" data-testid="settings-done">
      <div className="flex items-start gap-4 rounded-2xl bg-success-soft p-5 ring-1 ring-inset ring-success-border">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-success-foreground" />
        <p className="text-foreground/85">{t(`${base}.done.text`)}</p>
      </div>
      <section aria-labelledby="settings-visibility-title" className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-inset ring-border">
        <h4 id="settings-visibility-title" className="font-semibold">
          {t('marketingStudio.visibility')}
        </h4>
        <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground/85">
          {VISIBILITY_TIPS.map((key) => (
            <li key={key}>{t(`marketingStudio.${key}`)}</li>
          ))}
        </ol>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/short-rent/vetrina">{t('marketingStudio.storefront')}</Link>
        </Button>
      </section>
    </div>
  );
}
