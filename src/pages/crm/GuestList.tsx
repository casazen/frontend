import { GitMerge, SearchX, Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { ListPagination } from '@/components/shared/list-view/list-pagination';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import { formatDay, formatMoney } from '@/features/crm/lib/crm-format';
import { channelLabel, languageLabel } from '@/features/crm/lib/crm-labels';
import { contactStateOf } from '@/features/crm/profiles/contact-state';
import { ContactStateBadge } from '@/features/crm/profiles/contact-state-badge';
import { useProfileFilters } from '@/features/crm/profiles/profile-filter-state';
import { ProfileFilters } from '@/features/crm/profiles/profile-filters';
import { cn } from '@/lib/utils';
import { useGuestCrmProfiles } from '@/queries/crm';
import type { CrmProfileListItem } from '@/types/crm.types';

const profilePath = (id: string) => `/app/short-rent/crm/guests/${id}`;

/** Tags a row shows before "+3": the rest are in the profile. */
const TAGS_SHOWN = 3;

/** The e-mail state of a profile, from what the list knows of its best address. */
function emailStateOfProfile(profile: CrmProfileListItem) {
  return contactStateOf({
    hasAddress: profile.emailMasked !== '',
    basis: profile.emailBasis,
    reachable: profile.emailReachable,
  });
}

/** The name of a profile: the guest's; a lead without a name is known by its masked address. */
function ProfileName({ profile }: { profile: CrmProfileListItem }) {
  const { t } = useTranslation();
  const name = profile.displayName || profile.emailMasked || t('crm.list.noName');
  return (
    <Link
      to={profilePath(profile.id)}
      className="inline-flex min-h-8 items-center break-words font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {name}
    </Link>
  );
}

/** A mark on a profile that a person has to look at: a merge proposal waits for a decision. */
function MergeMark() {
  const { t } = useTranslation();
  return (
    <span
      data-testid="crm-merge-mark"
      title={t('crm.list.mergeProposalHint')}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES.warning)}
    >
      <GitMerge className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{t('crm.list.mergeProposal')}</span>
    </span>
  );
}

/** Words in small rounded boxes: the channels a guest booked on, the tags of a profile. */
function Chips({ items, label, testId }: { items: string[]; label: string; testId: string }) {
  if (items.length === 0) return null;
  return (
    <ul role="list" aria-label={label} data-testid={testId} className="flex flex-wrap gap-1">
      {items.map((item) => (
        <li key={item} className="max-w-full break-words rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** The tags of a profile, the first ones, and how many more there are (the rest are in the profile). */
function TagChips({ tags }: { tags: string[] }) {
  const { t } = useTranslation();
  const shown = tags.slice(0, TAGS_SHOWN);
  const more = tags.length - shown.length;
  return <Chips items={more > 0 ? [...shown, t('crm.list.moreTags', { count: more })] : shown} label={t('crm.list.tags')} testId="crm-tags" />;
}

/** Country and language of a profile on one line, as the guest has them. */
function useCountryAndLanguage(profile: CrmProfileListItem): string {
  const { t } = useTranslation();
  return [profile.country, profile.language ? languageLabel(t, profile.language) : ''].filter(Boolean).join(' · ');
}

/** The first cell of a row and the head of a card: the name, where the guest comes from, the tags and the mark of a proposal. */
function GuestCell({ profile, asCard = false }: { profile: CrmProfileListItem; asCard?: boolean }) {
  const origin = useCountryAndLanguage(profile);
  return (
    <div className="min-w-0 space-y-1">
      <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', asCard && 'text-base')}>
        <ProfileName profile={profile} />
        {profile.hasMergeProposal ? <MergeMark /> : null}
      </div>
      {origin ? <p className="break-words text-sm text-foreground/70">{origin}</p> : null}
      <TagChips tags={profile.tags} />
    </div>
  );
}

/** The e-mail of a profile: its state and, under it, the address masked. */
function EmailCell({ profile }: { profile: CrmProfileListItem }) {
  return (
    <div className="min-w-0 space-y-1">
      <ContactStateBadge state={emailStateOfProfile(profile)} />
      {profile.emailMasked ? <p className="break-all text-xs text-foreground/70">{profile.emailMasked}</p> : null}
    </div>
  );
}

/**
 * CRM guest list (NF-88, ADR-021): the profiles of the guests of the properties the caller reaches, with their stays, spend, channels
 * and the state of their e-mail. The search, the filters and the order live in the address and are applied by the server, inside the
 * caller's scope; a row opens the profile. The page never shows or asks for a document, a birth date or a birth place.
 */
export default function GuestList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { filters, params, activeCount, hasFilters, change, clear, searchOfPage } = useProfileFilters();
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useGuestCrmProfiles(params);
  const language = i18n.language;

  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 0;
  const lastPage = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  // A page that is not there any more (the last profile of it was merged): the list goes to the last one that is, instead of saying nothing.
  if (data && !isPlaceholderData && data.items.length === 0 && totalCount > 0 && filters.page > lastPage) {
    return <Navigate replace to={{ search: searchOfPage(lastPage) }} />;
  }

  const columns: DataColumn<CrmProfileListItem>[] = [
    { key: 'guest', header: t('crm.list.columns.guest'), rowHeader: true, cell: (profile) => <GuestCell profile={profile} /> },
    { key: 'stays', header: t('crm.list.columns.stays'), align: 'end', cell: (profile) => profile.totalStays },
    { key: 'spend', header: t('crm.list.columns.spend'), align: 'end', cell: (profile) => formatMoney(profile.totalSpend, language) },
    { key: 'lastStay', header: t('crm.list.columns.lastStay'), cell: (profile) => formatDay(profile.lastStayAt, language) ?? '—' },
    {
      key: 'channels',
      header: t('crm.list.columns.channels'),
      cell: (profile) => (
        <Chips items={profile.channels.map((channel) => channelLabel(t, channel))} label={t('crm.list.channels')} testId="crm-channels" />
      ),
    },
    { key: 'email', header: t('crm.list.columns.email'), cell: (profile) => <EmailCell profile={profile} /> },
  ];

  const renderCard = (profile: CrmProfileListItem) => {
    const lastStay = formatDay(profile.lastStayAt, language);
    return (
      <div className="min-w-0 space-y-2">
        <GuestCell profile={profile} asCard />
        <p className="text-sm text-foreground/70">
          {t('crm.list.staysCount', { count: profile.totalStays })} · {formatMoney(profile.totalSpend, language)}
          {lastStay ? ` · ${t('crm.list.lastStay', { date: lastStay })}` : ''}
        </p>
        <Chips items={profile.channels.map((channel) => channelLabel(t, channel))} label={t('crm.list.channels')} testId="crm-channels" />
        <EmailCell profile={profile} />
      </div>
    );
  };

  const empty = hasFilters
    ? {
        icon: SearchX,
        title: t('crm.list.noMatch.title'),
        description: t('crm.list.noMatch.description'),
        action: { label: t('crm.list.noMatch.action'), onClick: clear },
      }
    : { icon: Users, title: t('crm.list.empty.title'), description: t('crm.list.empty.description') };

  return (
    <div className="min-w-0 space-y-6" data-testid="crm-guest-list">
      <PageHeader title={t('crm.list.title')} description={t('crm.list.description')} />

      <ProfileFilters filters={filters} activeCount={activeCount} hasFilters={hasFilters} onChange={change} onClear={clear} />

      <div aria-busy={isPlaceholderData || undefined} className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
        <DataView
          label={t('crm.list.label')}
          rows={data?.items ?? []}
          columns={columns}
          rowKey={(profile) => profile.id}
          renderCard={renderCard}
          rowTestId={(profile) => `crm-profile-row-${profile.id}`}
          onRowClick={(profile) => void navigate(profilePath(profile.id))}
          cardsUntil="xl"
          isLoading={isLoading}
          isError={isError}
          error={error}
          errorTitle={t('crm.list.loadError')}
          onRetry={() => void refetch()}
          empty={empty}
          testId="crm-profiles"
          footer={
            data && totalCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p role="status" className="text-sm text-foreground/70" data-testid="crm-count">
                  {t('crm.list.count', { count: totalCount })}
                </p>
                <ListPagination page={filters.page} pageSize={pageSize} totalCount={totalCount} onPageChange={(page) => change({ page })} />
              </div>
            ) : undefined
          }
        />
      </div>
    </div>
  );
}
