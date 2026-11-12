import { Star, UserRoundSearch } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { PAGE_COLUMNS, PAGE_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { PlainSection, StatStrip, StatTile } from '@/components/shared/calm';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDay, formatDecimal, formatInstantDay, formatMoney } from '@/features/crm/lib/crm-format';
import { channelLabel, languageLabel } from '@/features/crm/lib/crm-labels';
import { ProfileContacts } from '@/features/crm/profiles/profile-contacts';
import { ProfileHistory } from '@/features/crm/profiles/profile-history';
import { ProfileTags } from '@/features/crm/profiles/profile-tags';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { useGuestCrmProfile } from '@/queries/crm';
import type { CrmGroupKind, CrmProfileDetail } from '@/types/crm.types';

const LIST_PATH = '/app/short-rent/crm/guests';
const MERGE_PATH = '/app/short-rent/crm/merge';

/** How a guest usually comes, with the key of the words of each (written out, so that the i18n test finds a missing translation). */
const GROUPS: ReadonlyArray<{ group: CrmGroupKind; labelKey: string }> = [
  { group: 'Single', labelKey: 'crm.detail.group.single' },
  { group: 'Couple', labelKey: 'crm.detail.group.couple' },
  { group: 'Family', labelKey: 'crm.detail.group.family' },
  { group: 'Group', labelKey: 'crm.detail.group.group' },
];

/** The page while the profile loads: the shape of the page, no spinner in the middle of nothing. */
function ProfileSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="crm-profile-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3 max-w-sm motion-reduce:animate-none" />
          <Skeleton className="h-4 w-1/2 max-w-xs motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-24 w-full motion-reduce:animate-none" />
        <Skeleton className="h-48 w-full motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** A list of "name · stays · spend" lines: the channels a guest booked on, the properties they stayed at. */
function BreakdownList({ label, rows }: { label: string; rows: Array<{ key: string; name: string; detail: string }> }) {
  return (
    <ul role="list" aria-label={label} className="divide-y text-sm">
      {rows.map((row) => (
        <li key={row.key} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2">
          <span className="min-w-0 break-words font-medium">{row.name}</span>
          <span className="text-foreground/70">{row.detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** The part of the profile that is about how the guest books and travels: group, channels, properties, reviews. */
function ProfileFigures({ profile }: { profile: CrmProfileDetail }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language;
  const { totals, reviews } = profile;
  const group = GROUPS.find((entry) => entry.group === totals.typicalGroup);

  return (
    <div className={PAGE_COLUMN}>
      <PlainSection title={t('crm.detail.group.title')} data-testid="crm-group-section">
        {group ? (
          <p className="text-sm">
            {t(group.labelKey)}
            <span className="block text-foreground/70">
              {t('crm.detail.group.average', {
                adults: formatDecimal(totals.averageAdults, language),
                children: formatDecimal(totals.averageChildren, language),
              })}
            </span>
          </p>
        ) : (
          <p className="text-sm text-foreground/70">{t('crm.detail.group.none')}</p>
        )}
      </PlainSection>

      <PlainSection title={t('crm.detail.channels.title')} data-testid="crm-channels-section">
        {totals.byChannel.length === 0 ? (
          <p className="text-sm text-foreground/70">{t('crm.detail.channels.empty')}</p>
        ) : (
          <BreakdownList
            label={t('crm.detail.channels.title')}
            rows={totals.byChannel.map((entry) => ({
              key: entry.channel,
              name: channelLabel(t, entry.channel),
              detail: `${t('crm.detail.staysCount', { count: entry.stays })} · ${formatMoney(entry.spend, language)}`,
            }))}
          />
        )}
      </PlainSection>

      <PlainSection title={t('crm.detail.properties.title')} data-testid="crm-properties-section">
        {totals.byProperty.length === 0 ? (
          <p className="text-sm text-foreground/70">{t('crm.detail.properties.empty')}</p>
        ) : (
          <BreakdownList
            label={t('crm.detail.properties.title')}
            rows={totals.byProperty.map((entry) => ({
              key: entry.propertyId,
              name: entry.propertyName,
              detail: t('crm.detail.staysCount', { count: entry.stays }),
            }))}
          />
        )}
      </PlainSection>

      <PlainSection title={t('crm.detail.reviews.title')} data-testid="crm-reviews-section">
        {reviews.count === 0 || reviews.averageRating === null ? (
          <p className="text-sm text-foreground/70">{t('crm.detail.reviews.empty')}</p>
        ) : (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-1.5">
              <Star className="size-4 shrink-0 text-foreground/70" aria-hidden="true" />
              <span>
                {t('crm.detail.reviews.average', { rating: formatDecimal(reviews.averageRating, language) })}
                <span className="text-foreground/70"> · {t('crm.detail.reviews.count', { count: reviews.count })}</span>
              </span>
            </p>
            <ul role="list" aria-label={t('crm.detail.reviews.latest')} className="divide-y">
              {reviews.latest.map((review, index) => (
                <li key={`${review.publishedAt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 py-1.5">
                  <span>{t('crm.detail.reviews.entry', { rating: review.rating })}</span>
                  <span className="text-foreground/70">{formatInstantDay(review.publishedAt, language) ?? ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </PlainSection>
    </div>
  );
}

/**
 * CRM guest detail (E07/F01/US04/T02, NF-88): one profile read by its own id (`GET api/crm/guests/{id}`), so a reload works. The header
 * says who the guest is and since when, and opens the guest record; under it the totals, the contacts with what the host may do with
 * each, the tags the host can edit, how the guest books and travels, and the history of the stays. A profile of another org or out of the
 * caller's reach is "not found", like a missing one. Nothing of the Alloggiati registration (document, birth date, birth place,
 * co-guests) is shown or asked for.
 */
export default function GuestDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', 'guest.write');
  const { data: profile, isLoading, isError, error, refetch } = useGuestCrmProfile(id);
  const language = i18n.language;

  if (isLoading) {
    return <ProfileSkeleton label={t('crm.detail.loading')} />;
  }

  // An API error is never shown as "not found": only a 404 is. And a 404 is "not found" even when the page still holds the profile it read
  // before (a query keeps its last data when the next read fails): the profile was merged into another (what goes stays as a tombstone),
  // or the caller lost its reach. The old page must not stay on the screen, with controls that can only fail.
  const notFound = isError && getHttpStatus(error) === 404;
  if (isError && !notFound) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader crumbs="auto" title={t('crm.detail.fallbackTitle')} />
        <ErrorState testId="crm-profile-error" title={t('crm.detail.loadError')} error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!profile || notFound) {
    return (
      <div className="min-w-0 space-y-6">
        <PageHeader crumbs="auto" title={t('crm.detail.fallbackTitle')} />
        <EmptyState
          icon={UserRoundSearch}
          title={t('crm.detail.notFound.title')}
          description={t('crm.detail.notFound.description')}
          action={{ label: t('crm.detail.backToList'), href: LIST_PATH }}
        />
      </div>
    );
  }

  const since = formatDay(profile.firstStayAt, language);
  const origin = [profile.country, profile.language ? languageLabel(t, profile.language) : ''].filter(Boolean).join(' · ');
  const description = [since ? t('crm.detail.since', { date: since }) : t('crm.detail.noStayYet'), origin].filter(Boolean).join(' · ');
  const { totals } = profile;

  return (
    <div className="min-w-0 space-y-8" data-testid="crm-profile">
      <PageHeader
        crumbs="auto"
        title={profile.displayName || t('crm.detail.unnamed')}
        description={description}
        action={
          profile.primaryGuestId ? (
            <Button asChild variant="outline">
              <Link to={`/app/short-rent/guests/${profile.primaryGuestId}`}>{t('crm.detail.guestRecord')}</Link>
            </Button>
          ) : undefined
        }
      />

      {canWrite && profile.mergeProposalCount > 0 ? (
        <Alert
          variant="info"
          data-testid="crm-profile-merge-note"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to={MERGE_PATH}>{t('crm.detail.mergeLink')}</Link>
            </Button>
          }
        >
          {t('crm.detail.mergeProposals', { count: profile.mergeProposalCount })}
        </Alert>
      ) : null}

      <StatStrip label={t('crm.detail.totals.label')}>
        <StatTile label={t('crm.detail.totals.stays')} value={totals.stays} />
        <StatTile label={t('crm.detail.totals.spend')} value={formatMoney(totals.spend, language)} />
        <StatTile label={t('crm.detail.totals.averageSpend')} value={totals.stays > 0 ? formatMoney(totals.averageSpend, language) : '—'} />
        <StatTile
          label={t('crm.detail.totals.advance')}
          value={totals.averageAdvanceDays === null ? '—' : t('crm.detail.totals.advanceDays', { count: Math.round(totals.averageAdvanceDays) })}
        />
      </StatStrip>

      <div className={PAGE_COLUMNS}>
        <div className={PAGE_COLUMN}>
          <ProfileContacts profileId={profile.id} contacts={profile.contacts} primaryGuestId={profile.primaryGuestId} canWrite={canWrite} />
          <ProfileTags profileId={profile.id} tags={profile.tags} canWrite={canWrite} />
        </div>
        <ProfileFigures profile={profile} />
      </div>

      <ProfileHistory stays={profile.stays} truncated={profile.staysTruncated} />
    </div>
  );
}
