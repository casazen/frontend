import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useFormContext, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useOptionalWizard } from '@/components/shared/wizard/wizard-context';
import { WizardSummary, type WizardSummaryItem } from '@/components/shared/wizard/wizard-summary';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { useFoundListings, useIcalFeedsOfProperties, useShortRentProperties } from '@/queries/use-octorate-mapping';
import type { OctorateListing } from '@/types';
import type { PropertyIcalFeed, PropertyIcalFeedChannel } from '@/types/property-ical';
import type { ConnectWizardValues } from './inventory-scenario';
import { listingName, roomName } from './listing-labels';
import { StepProblem } from './listing-parts';
import {
  MAPPING_STEP_ID,
  buildMappingPlan,
  hasSeveralRooms,
  type ListingOutcome,
  type MappingProgress,
  type ResultKind,
  type ResultRow,
} from './mapping-model';

const NO_DECISIONS: ConnectWizardValues['decisions'] = [];

/** The lines of one answer of the summary, one under the other. */
function Lines({ lines }: { lines: readonly string[] }) {
  return (
    <span className="block space-y-1">
      {lines.map((line, index) => (
        <span key={`${index}:${line}`} className="block break-words">
          {line}
        </span>
      ))}
    </span>
  );
}

interface ConnectSummaryStepProps {
  /** The run in progress, if there is one: the last button is working through the listings. */
  progress: MappingProgress | null;
  /** The listings the last run could not do, with the reason: the host fixes them and runs the rest again. */
  failures: readonly ListingOutcome[];
}

/**
 * Step 6, "Riepilogo" (E02/F01/US02/T05, NF-05): before the import, in plain words, what will happen and where. The host has decided
 * about the listings in the step before; nothing has been sent. The last button of the wizard does it, and each line can be changed:
 * "Modifica" goes back to the step of the answers (the answers are kept).
 *
 * After a run that did not do everything, the listings that failed are listed here with the reason in the words of the app, and a link
 * to fix them: the ones that were done stay done (they are not listings to do any more), so running again only does the rest.
 */
export function ConnectSummaryStep({ progress, failures }: ConnectSummaryStepProps) {
  const { t } = useTranslation();
  const listings = useFoundListings();
  const properties = useShortRentProperties();
  const { control } = useFormContext<ConnectWizardValues>();
  const decisions = useWatch({ control, name: 'decisions' }) ?? NO_DECISIONS;
  const wizard = useOptionalWizard();

  if (listings.isPending) {
    return (
      <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted p-4 text-sm" data-testid="octorate-summary-loading">
        <Spinner size="sm" />
        <span className="min-w-0 break-words">{t('octorate.connect.summary.loading')}</span>
      </div>
    );
  }
  if (listings.isError) {
    return (
      <StepProblem
        title={t('octorate.connect.summary.loadFailed')}
        error={listings.error}
        onRetry={() => void listings.refetch()}
        testId="octorate-summary-error"
      />
    );
  }

  const found = listings.data;
  const byId = new Map(found.map((listing) => [listing.octorateAccommodationId, listing]));
  const nameOf = (listingId: string) => {
    const listing = byId.get(listingId);
    return listing ? listingName(listing, t) : listingId;
  };
  const propertyNames = new Map<string, string>();
  for (const listing of found) {
    for (const property of listing.candidates) propertyNames.set(property.id, property.name);
    if (listing.proposedProperty) propertyNames.set(listing.proposedProperty.id, listing.proposedProperty.name);
  }
  for (const property of properties.data ?? []) propertyNames.set(property.id, property.name);

  const plan = buildMappingPlan(found, decisions);
  // A failure of an earlier run is shown while its listing is still waiting to be done: an answer changed since, or a listing done
  // meanwhile, takes it away.
  const waiting = new Set(plan.actions.map((action) => action.listingId));
  const stillFailing = failures.filter((failure) => waiting.has(failure.listingId));
  const withRoom = (line: string, listingId: string, roomId: string) => {
    const room = byId.get(listingId)?.rooms.find((candidate) => candidate.id === roomId);
    return room ? `${line} · ${t('octorate.connect.summary.withRoom', { room: roomName(room, t) })}` : line;
  };

  const linkedLines = plan.actions.flatMap((action) =>
    action.kind === 'confirm'
      ? [
          withRoom(
            t('octorate.connect.summary.linkedLine', {
              listing: nameOf(action.listingId),
              property: propertyNames.get(action.propertyId) ?? t('octorate.connect.summary.unknownProperty'),
            }),
            action.listingId,
            action.roomId,
          ),
        ]
      : [],
  );
  const importedLines = plan.actions.flatMap((action) =>
    action.kind === 'import' ? [withRoom(nameOf(action.listingId), action.listingId, action.roomId)] : [],
  );
  const excludedLines = plan.actions.flatMap((action) => (action.kind === 'reject' ? [nameOf(action.listingId)] : []));
  const roomLines = plan.actions.flatMap((action) =>
    action.kind === 'room' ? [withRoom(nameOf(action.listingId), action.listingId, action.roomId)] : [],
  );
  const laterLines = plan.later.map((listing) => listingName(listing, t));

  const groups: Array<{ id: string; label: string; lines: string[] }> = [
    { id: 'linked', label: t('octorate.connect.summary.groups.linked.label'), lines: linkedLines },
    { id: 'imported', label: t('octorate.connect.summary.groups.imported.label'), lines: importedLines },
    { id: 'rooms', label: t('octorate.connect.summary.groups.rooms.label'), lines: roomLines },
    { id: 'excluded', label: t('octorate.connect.summary.groups.excluded.label'), lines: excludedLines },
    { id: 'later', label: t('octorate.connect.summary.groups.later.label'), lines: laterLines },
  ];
  const items: WizardSummaryItem[] = groups
    .filter((group) => group.lines.length > 0)
    .map((group) => ({ id: group.id, label: group.label, value: <Lines lines={group.lines} />, stepId: MAPPING_STEP_ID }));

  const touchesCasazen = linkedLines.length + importedLines.length + roomLines.length + excludedLines.length > 0;
  const readsChannels = linkedLines.length + importedLines.length > 0;
  // What, where and when (NF-05), in as few lines as the case needs: what the choices touch and when, what an import is, what CasaZen
  // reads afterwards and what to do about the iCal calendars, what stays for later.
  const explain = [
    touchesCasazen ? `${t('octorate.connect.summary.explain.where')} ${t('octorate.connect.summary.explain.when')}` : null,
    importedLines.length > 0 ? t('octorate.connect.summary.explain.imported') : null,
    readsChannels ? `${t('octorate.connect.summary.explain.reads')} ${t('octorate.connect.summary.explain.ical')}` : null,
    laterLines.length > 0 ? t('octorate.connect.summary.explain.later') : null,
    t('octorate.connect.summary.explain.safe'),
  ].filter((line): line is string => line !== null);

  return (
    <div className="space-y-4" data-testid="octorate-summary-step">
      {stillFailing.length > 0 ? (
        <Alert variant="danger" title={t('octorate.connect.summary.failed.title')} data-testid="octorate-summary-failed">
          <ul className="space-y-1" role="list">
            {stillFailing.map((failure) => (
              <li key={failure.listingId} className="break-words" data-testid={`octorate-summary-failed-${failure.listingId}`}>
                <span className="font-medium">{nameOf(failure.listingId)}</span>
                {': '}
                {getProblemMessage(failure.error, t) ?? t('octorate.connect.summary.failed.unknown')}
              </li>
            ))}
          </ul>
          {wizard ? (
            <Link
              to={wizard.hrefFor(MAPPING_STEP_ID)}
              data-testid="octorate-summary-fix"
              className="mt-2 inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t('octorate.connect.summary.failed.fix')}
            </Link>
          ) : null}
        </Alert>
      ) : null}

      {plan.actions.length === 0 ? (
        <p className="rounded-lg bg-muted p-3 text-sm" data-testid="octorate-summary-nothing">
          {t('octorate.connect.summary.nothing')}
        </p>
      ) : null}
      {items.length > 0 ? <WizardSummary items={items} /> : null}

      <ul className="list-disc space-y-1.5 pl-5 text-sm" data-testid="octorate-summary-explain">
        {explain.map((line) => (
          <li key={line} className="break-words">
            {line}
          </li>
        ))}
      </ul>

      {progress ? (
        <div className="flex min-w-0 items-center gap-3 rounded-lg bg-muted p-3 text-sm" data-testid="octorate-summary-progress">
          <Spinner size="sm" />
          <span className="min-w-0 break-words" aria-live="polite">
            {t('octorate.connect.summary.progress', { done: progress.done, total: progress.total })}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** How the result names what became of a listing: the word on the badge, the sentence under the name, and the look of the badge. */
const RESULT_TEXT: Readonly<
  Record<ResultKind, { badgeKey: string; textKey: string; variant: 'success' | 'secondary' | 'warning' | 'outline' | 'destructive' }>
> = {
  linked: { badgeKey: 'octorate.connect.summary.result.linked.badge', textKey: 'octorate.connect.summary.result.linked.text', variant: 'success' },
  imported: {
    badgeKey: 'octorate.connect.summary.result.imported.badge',
    textKey: 'octorate.connect.summary.result.imported.text',
    variant: 'success',
  },
  later: { badgeKey: 'octorate.connect.summary.result.later.badge', textKey: 'octorate.connect.summary.result.later.text', variant: 'warning' },
  excluded: {
    badgeKey: 'octorate.connect.summary.result.excluded.badge',
    textKey: 'octorate.connect.summary.result.excluded.text',
    variant: 'outline',
  },
  failed: {
    badgeKey: 'octorate.connect.summary.result.failed.badge',
    textKey: 'octorate.connect.summary.result.failed.text',
    variant: 'destructive',
  },
};

/** A listing that is linked but has several rooms and none chosen: CasaZen does not know which one to write to. */
function missesItsRoom(listing: OctorateListing): boolean {
  return hasSeveralRooms(listing) && !listing.octorateProductId;
}

function ResultListingRow({ row }: { row: ResultRow }) {
  const { t } = useTranslation();
  const { listing, kind, outcome } = row;
  const text = RESULT_TEXT[kind];
  const property = listing.proposedProperty?.name ?? '';
  // The sentences of a linked or imported listing name its property; with no property to name there is no sentence.
  const detail =
    kind === 'failed'
      ? (getProblemMessage(outcome?.error, t) ?? t('octorate.connect.summary.failed.unknown'))
      : (kind === 'linked' || kind === 'imported') && !property
        ? ''
        : t(text.textKey, { property });
  const blocked = kind === 'later' && (listing.status === 'Ambiguous' || listing.proposedProperty !== null);

  return (
    <li
      className="flex min-w-0 items-start justify-between gap-3 rounded-md border p-3 text-sm"
      data-testid={`octorate-result-${listing.octorateAccommodationId}`}
      data-result={kind}
    >
      <div className="min-w-0">
        <p className="break-words font-medium">{listingName(listing, t)}</p>
        {detail ? <p className="break-words text-muted-foreground">{detail}</p> : null}
        {blocked ? <p className="break-words text-muted-foreground">{t('octorate.connect.summary.result.later.blocked')}</p> : null}
        {(kind === 'linked' || kind === 'imported') && missesItsRoom(listing) ? (
          <p className="break-words text-muted-foreground">{t('octorate.connect.summary.result.roomMissing')}</p>
        ) : null}
      </div>
      <Badge variant={text.variant} className="shrink-0 whitespace-nowrap">
        {t(text.badgeKey)}
      </Badge>
    </li>
  );
}

/** The channels of an iCal feed, by name: Airbnb and Booking.com are named, any other calendar by the label the host gave it. */
const FEED_CHANNELS: Readonly<Record<PropertyIcalFeedChannel, { labelKey: string }>> = {
  Airbnb: { labelKey: 'ical.channels.Airbnb' },
  BookingCom: { labelKey: 'ical.channels.BookingCom' },
  Other: { labelKey: 'ical.channels.Other' },
};

const DATE_ONLY: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };

interface IcalNoticeProps {
  rows: readonly ResultRow[];
}

/**
 * What becomes of the iCal calendars the host already has on each channel, for every property that is confirmed now (E02/F02/US01/T03,
 * ADR-002). CasaZen keeps reading the iCal of a channel until the channel manager has read the calendar once; from then on the feed is
 * "deprecated": the channel manager replaces it since a date, and the host removes CasaZen's iCal link in the settings of that channel.
 * The calendar then comes from one source and the bookings are not counted twice.
 */
function IcalNotice({ rows }: IcalNoticeProps) {
  const { t, i18n } = useTranslation();
  const titleId = useId();
  const confirmed = rows.flatMap((row) =>
    (row.kind === 'linked' || row.kind === 'imported') && row.listing.proposedProperty ? [row.listing.proposedProperty] : [],
  );
  const queries = useIcalFeedsOfProperties(confirmed.map((property) => property.id));

  const entries = confirmed.flatMap((property, index) => {
    const feeds = queries[index]?.data ?? [];
    return feeds.length > 0 ? [{ property, feeds }] : [];
  });
  const unreadable = queries.some((query) => query.isError);

  const feedText = (feed: PropertyIcalFeed) => {
    const known = FEED_CHANNELS[feed.channel] ?? FEED_CHANNELS.Other;
    const channel = feed.channel === 'Other' && feed.label?.trim() ? feed.label.trim() : t(known.labelKey);
    if (!feed.deprecated) return t('octorate.connect.summary.ical.keeps', { channel });
    const date = feed.deprecatedAt ? formatRomeDateTime(feed.deprecatedAt, i18n.language, DATE_ONLY) : '';
    return date ? t('octorate.connect.summary.ical.replaced', { channel, date }) : t('octorate.connect.summary.ical.replacedNoDate', { channel });
  };

  if (entries.length === 0 && !unreadable) return null;

  return (
    <section aria-labelledby={titleId} className="space-y-3 rounded-lg bg-muted p-4 text-left" data-testid="octorate-ical-notice">
      <h3 id={titleId} className="text-base font-semibold">
        {t('octorate.connect.summary.ical.title')}
      </h3>
      {entries.length > 0 ? (
        <>
          <p className="text-sm">{t('octorate.connect.summary.ical.intro')}</p>
          <ul className="space-y-3" role="list">
            {entries.map(({ property, feeds }) => (
              <li key={property.id} className="space-y-1 text-sm" data-testid={`octorate-ical-property-${property.id}`}>
                <p className="break-words font-medium">{property.name}</p>
                <ul className="list-disc space-y-1 pl-5" role="list">
                  {feeds.map((feed) => (
                    <li key={feed.id} className="break-words" data-deprecated={feed.deprecated ? 'true' : 'false'}>
                      {feedText(feed)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium">{t('octorate.connect.summary.ical.benefit')}</p>
        </>
      ) : null}
      {unreadable ? <p className="text-sm text-muted-foreground">{t('octorate.connect.summary.ical.loadFailed')}</p> : null}
    </section>
  );
}

interface ConnectResultProps {
  rows: readonly ResultRow[];
}

/**
 * The result of the wizard (E02/F01/US02/T05, NF-05): one row for each listing, saying what became of it (linked, imported, left for
 * later, excluded, failed), and what happens to the iCal calendars the host already has on the channels of the properties just linked.
 */
export function ConnectResult({ rows }: ConnectResultProps) {
  const { t } = useTranslation();
  const titleId = useId();

  return (
    <div className="space-y-4 text-left" data-testid="octorate-result">
      <section aria-labelledby={titleId} className="space-y-2">
        <h3 id={titleId} className="text-base font-semibold">
          {t('octorate.connect.summary.result.title')}
        </h3>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('octorate.connect.summary.result.none')}</p>
        ) : (
          <ul className="space-y-2" role="list">
            {rows.map((row) => (
              <ResultListingRow key={row.listing.octorateAccommodationId} row={row} />
            ))}
          </ul>
        )}
      </section>
      <IcalNotice rows={rows} />
    </div>
  );
}
