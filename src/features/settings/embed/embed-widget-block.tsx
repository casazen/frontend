import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { useWorkspace } from '@/hooks/use-workspace';
import { isPropertyPublishable } from '@/lib/booking-url';
import { useProperties } from '@/queries/use-properties';
import { useOrgDestinations } from '@/queries/use-public-stays';
import { EmbedSnippetPanel, type SnippetPlan } from './embed-snippet-panel';
import { EMBED_WIDGETS, publicDestinations, readSearchTarget, type EmbedBase, type EmbedWidget } from './embed-snippet';

/** The part of the i18n keys of a widget (`embed.settings.widgets.<key>`): the widget `guest-access` is `guestAccess` there. */
const WIDGET_TEXT_KEY: Record<EmbedWidget, string> = {
  booking: 'booking',
  property: 'property',
  'guest-access': 'guestAccess',
  search: 'search',
};

interface ChoiceProps {
  origin: EmbedBase;
}

/**
 * The widget of one home: the homes of the org that are published on the site (a home that is not is never shown by the widget), in a select. The first one is the choice until the
 * host picks another, so the code and the preview are there at once. The slug of the home goes in the code (its id when it has none, as the links of the site do).
 */
function PropertyChoice({ origin, propertyId, onPropertyChange }: ChoiceProps & { propertyId: string; onPropertyChange: (id: string) => void }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  // Mounted only while the widget of a home is the choice, and read again each time: a home is published on another page, which this one does not watch.
  const homes = useProperties({ mode: 'short' }, { fresh: true, enabled: hasPermission('short-rent', 'property.read') });
  const publishable = useMemo(
    () =>
      (homes.data ?? []).filter((home) =>
        isPropertyPublishable({ isActive: home.isActive, isPaused: home.isPaused, complianceStatus: home.complianceStatus ?? undefined }),
      ),
    [homes.data],
  );
  const chosen = publishable.find((home) => home.id === propertyId) ?? publishable[0];

  let plan: SnippetPlan;
  if (chosen) {
    plan = { state: 'ready', input: { ...origin, widget: 'property', property: chosen.slug?.trim() || chosen.id } };
  } else {
    plan = { state: 'waiting', message: homes.isLoading ? t('embed.settings.property.loading') : t('embed.settings.snippet.waiting.property') };
  }

  return (
    <div className="space-y-5">
      {homes.isError ? (
        <Alert
          variant="danger"
          data-testid="embed-property-error"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void homes.refetch()}>
              {t('embed.settings.retry')}
            </Button>
          }
        >
          {t('embed.settings.property.loadError')}
        </Alert>
      ) : homes.isLoading ? null : publishable.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="embed-property-empty">
          {t('embed.settings.property.empty')}
        </p>
      ) : (
        <Field label={t('embed.settings.property.label')} className="max-w-md">
          <Select value={chosen?.id ?? ''} onChange={(event) => onPropertyChange(event.target.value)} data-testid="embed-property-select">
            {publishable.map((home) => (
              <option key={home.id} value={home.id}>
                {home.city ? `${home.name} (${home.city})` : home.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <EmbedSnippetPanel plan={plan} />
    </div>
  );
}

/**
 * The search bar: it asks for the page of the agency's site that holds the booking engine (an address of the web, `http` or `https`: the bar leads there with the stay in its
 * address), and offers the places of the site, which are read from the public list of the org. The code waits for a valid address and for the places: a code that leaves them
 * out because they were late would be a code that differs from the one the host sees the next time.
 */
function SearchChoice({
  origin,
  orgSlug,
  target,
  onTargetChange,
}: ChoiceProps & { orgSlug: string; target: string; onTargetChange: (target: string) => void }) {
  const { t } = useTranslation();
  // Read again each time the bar is chosen: the places are those of the homes published today, and a home is published on another page.
  const destinations = useOrgDestinations(orgSlug, { fresh: true });
  const read = readSearchTarget(target);
  const places = useMemo(() => publicDestinations((destinations.data ?? []).map(({ id, label }) => ({ id, label }))), [destinations.data]);

  let plan: SnippetPlan;
  if (read.state !== 'valid') plan = { state: 'waiting', message: t('embed.settings.snippet.waiting.target') };
  else if (destinations.isError) plan = { state: 'waiting', message: t('embed.settings.snippet.waiting.destinationsFailed') };
  else if (destinations.isPending) plan = { state: 'waiting', message: t('embed.settings.snippet.waiting.destinations') };
  else plan = { state: 'ready', input: { ...origin, widget: 'search', target: read.url, destinations: places } };

  return (
    <div className="space-y-5">
      <Field
        label={t('embed.settings.search.targetLabel')}
        hint={t('embed.settings.search.targetHint')}
        error={read.state === 'invalid' ? t('embed.settings.search.targetInvalid') : undefined}
        className="max-w-xl"
      >
        <Input
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          value={target}
          placeholder={t('embed.settings.search.targetPlaceholder')}
          onChange={(event) => onTargetChange(event.target.value)}
          data-testid="embed-search-target"
        />
      </Field>
      {destinations.isError ? (
        <Alert
          variant="danger"
          data-testid="embed-destinations-error"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void destinations.refetch()}>
              {t('embed.settings.retry')}
            </Button>
          }
        >
          {t('embed.settings.search.destinationsFailed')}
        </Alert>
      ) : destinations.data ? (
        <p className="text-sm text-muted-foreground" data-testid="embed-destinations-note">
          {places.length > 0 ? t('embed.settings.search.destinationsIncluded', { count: places.length }) : t('embed.settings.search.destinationsNone')}
        </p>
      ) : null}
      <EmbedSnippetPanel plan={plan} />
    </div>
  );
}

interface EmbedWidgetBlockProps {
  /** Where the loader and the frames are served from (`resolveEmbedBase`): the agency's own domain when it has one, else the origin of CasaZen and the slug of the org. */
  origin: EmbedBase;
  /** The slug of the org, for the places of its site. */
  orgSlug: string;
}

/**
 * The one highlighted block of the page (E41/F03/US01, NF-147): the choice of the widget, what it needs, the code to paste and the preview, together. What the host chose (the home,
 * the address of the page) is kept while they look at another widget and come back; it is never stored anywhere else.
 */
export function EmbedWidgetBlock({ origin, orgSlug }: EmbedWidgetBlockProps) {
  const { t } = useTranslation();
  const [widget, setWidget] = useState<EmbedWidget>('booking');
  const [propertyId, setPropertyId] = useState('');
  const [target, setTarget] = useState('');

  const options: SegmentedOption<EmbedWidget>[] = EMBED_WIDGETS.map((value) => ({
    value,
    label: t(`embed.settings.widgets.${WIDGET_TEXT_KEY[value]}.label`),
    testId: `embed-widget-${value}`,
  }));

  return (
    <Card data-testid="embed-widget-block">
      <CardHeader>
        <CardTitle>{t('embed.settings.focus.title')}</CardTitle>
        <CardDescription>{t('embed.settings.focus.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Segmented label={t('embed.settings.picker.label')} options={options} value={widget} onValueChange={setWidget} testId="embed-widget-picker" />
          <p className="text-sm text-muted-foreground" data-testid="embed-widget-help">
            {t(`embed.settings.widgets.${WIDGET_TEXT_KEY[widget]}.help`)}
          </p>
        </div>

        {widget === 'property' ? (
          <PropertyChoice origin={origin} propertyId={propertyId} onPropertyChange={setPropertyId} />
        ) : widget === 'search' ? (
          <SearchChoice origin={origin} orgSlug={orgSlug} target={target} onTargetChange={setTarget} />
        ) : (
          <EmbedSnippetPanel plan={{ state: 'ready', input: { ...origin, widget } }} />
        )}
      </CardContent>
    </Card>
  );
}
