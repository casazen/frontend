import { CalendarCheck, Clock, GitMerge, Heart, Languages, Mail, MailCheck, MapPin, Repeat, SearchX, Send, Upload, Users, UsersRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { NextStepCard } from '@/components/shared/calm/next-step-card';
import { StatStrip, StatTile } from '@/components/shared/calm/stat-strip';
import { ListCardBody } from '@/components/shared/list-view/list-card';
import { ListPagination } from '@/components/shared/list-view/list-pagination';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import { CrmAvatar } from '@/features/crm/lib/crm-avatar';
import { CrmEmptyState } from '@/features/crm/lib/crm-empty-state';
import { formatDay, formatMoney, formatRelativeDay } from '@/features/crm/lib/crm-format';
import { channelIcon, channelLabel, languageLabel } from '@/features/crm/lib/crm-labels';
import { contactStateOf } from '@/features/crm/profiles/contact-state';
import { ContactStateBadge } from '@/features/crm/profiles/contact-state-badge';
import { useProfileFilters } from '@/features/crm/profiles/profile-filter-state';
import { ProfileFilters } from '@/features/crm/profiles/profile-filters';
import { useWorkspace } from '@/hooks/use-workspace';
import { cn } from '@/lib/utils';
import { useCampaigns, useSegments } from '@/queries/campaigns';
import { useCrmOverview, useGuestCrmProfiles, type CrmOverview } from '@/queries/crm';
import type { CrmProfileListItem } from '@/types/crm.types';

const CRM_PATH = '/app/short-rent/crm';
const profilePath = (id: string) => `${CRM_PATH}/guests/${id}`;
const NEW_CAMPAIGN_PATH = `${CRM_PATH}/campaigns?new=1`;
const NEW_GROUP_PATH = `${CRM_PATH}/segments?new=1`;
const IMPORT_PATH = `${CRM_PATH}/segments?import=1`;
const GUESTS_HELP_PATH = '/app/short-rent/help#guide-guests';

/** Tags a row shows before "+3": the rest are in the profile. */
const TAGS_SHOWN = 3;

type NextStepKind = 'group' | 'campaign';

const NEXT_STEPS: Record<NextStepKind, { titleKey: string; detailKey: string; ctaKey: string; href: string }> = {
  group: { titleKey: 'crm.nextStep.group.title', detailKey: 'crm.nextStep.group.detail', ctaKey: 'crm.nextStep.group.cta', href: NEW_GROUP_PATH },
  campaign: { titleKey: 'crm.nextStep.campaign.title', detailKey: 'crm.nextStep.campaign.detail', ctaKey: 'crm.nextStep.campaign.cta', href: NEW_CAMPAIGN_PATH },
};

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
      className="inline-flex min-h-8 items-center break-words font-semibold text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {name}
    </Link>
  );
}

/**
 * A mark on a profile that a person has to look at: a merge proposal waits for a decision. The page of the duplicates is for who may
 * write the guests (`guest.write`): to who may only read them the mark says the same without sending them to a page they cannot open.
 */
function MergeMark() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canDecide = hasPermission('short-rent', 'guest.write');
  return (
    <span
      data-testid="crm-merge-mark"
      title={canDecide ? t('crm.list.mergeProposalHint') : t('crm.list.mergeProposalHintReadOnly')}
      className={cn('inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset', STATUS_TONE_CLASSES.warning)}
    >
      <GitMerge className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0 break-words">{t('crm.list.mergeProposal')}</span>
    </span>
  );
}

/** The tags of a profile, the first ones, and how many more there are (the rest are in the profile). */
function TagChips({ tags }: { tags: string[] }) {
  const { t } = useTranslation();
  if (tags.length === 0) return null;
  const shown = tags.slice(0, TAGS_SHOWN);
  const more = tags.length - shown.length;
  const items = more > 0 ? [...shown, t('crm.list.moreTags', { count: more })] : shown;
  return (
    <ul role="list" aria-label={t('crm.list.tags')} data-testid="crm-tags" className="flex flex-wrap gap-1">
      {items.map((item) => (
        <li key={item} className="max-w-full break-words rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-text">
          {item}
        </li>
      ))}
    </ul>
  );
}

/** The channels a guest booked on, each with the small icon of its kind. */
function ChannelChips({ channels }: { channels: string[] }) {
  const { t } = useTranslation();
  if (channels.length === 0) return null;
  return (
    <ul role="list" aria-label={t('crm.list.channels')} data-testid="crm-channels" className="flex flex-wrap gap-1">
      {channels.map((channel) => {
        const Icon = channelIcon(channel);
        return (
          <li key={channel} className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
            <Icon className="size-3 shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{channelLabel(t, channel)}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Where the guest comes from and the language they speak, as the guest has them. */
function Origin({ profile }: { profile: CrmProfileListItem }) {
  const { t } = useTranslation();
  const language = profile.language ? languageLabel(t, profile.language) : '';
  if (!profile.country && !language) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm font-normal text-foreground/70">
      {profile.country ? (
        <span className="inline-flex items-center gap-1">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          {profile.country}
        </span>
      ) : null}
      {language ? (
        <span className="inline-flex items-center gap-1">
          <Languages className="size-3.5 shrink-0" aria-hidden="true" />
          {language}
        </span>
      ) : null}
    </p>
  );
}

/** The first cell of a row: the face, the name, where the guest comes from, the tags and the mark of a proposal. */
function GuestCell({ profile }: { profile: CrmProfileListItem }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <CrmAvatar name={profile.displayName} />
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <ProfileName profile={profile} />
          {profile.hasMergeProposal ? <MergeMark /> : null}
        </div>
        <Origin profile={profile} />
        <TagChips tags={profile.tags} />
      </div>
    </div>
  );
}

/** How many stays and, under it in bold, what the guest spent. */
function StaysCell({ profile }: { profile: CrmProfileListItem }) {
  const { t, i18n } = useTranslation();
  if (profile.totalStays === 0) return <span className="text-foreground/70">{t('crm.list.noStays')}</span>;
  return (
    <div className="space-y-0.5">
      <p>{t('crm.list.staysCount', { count: profile.totalStays })}</p>
      <p className="font-semibold text-foreground">{formatMoney(profile.totalSpend, i18n.language)}</p>
    </div>
  );
}

/** The last stay as people say it ("3 giorni fa") and, under it, the day. */
function LastStayCell({ profile }: { profile: CrmProfileListItem }) {
  const { i18n } = useTranslation();
  const day = formatDay(profile.lastStayAt, i18n.language);
  if (!day) return <span className="text-foreground/70">—</span>;
  return (
    <div className="space-y-0.5" title={day}>
      <p>{formatRelativeDay(profile.lastStayAt, i18n.language)}</p>
      <p className="text-xs text-foreground/70">{day}</p>
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

/** The four numbers over the list: who the guests are, how many can be written to, how many came back and how many are loyal. */
function GuestOverview({ overview }: { overview: CrmOverview }) {
  const { t } = useTranslation();
  return (
    <StatStrip label={t('crm.overview.label')} data-testid="crm-overview">
      <StatTile icon={Users} label={t('crm.overview.guests')} value={overview.guests} />
      <StatTile icon={MailCheck} label={t('crm.overview.reachable')} value={overview.reachableByEmail} />
      <StatTile icon={Repeat} label={t('crm.overview.returning')} value={overview.returned} />
      <StatTile icon={Heart} label={t('crm.overview.loyal')} value={overview.loyal} />
    </StatStrip>
  );
}

/** The one highlighted block of the page: the next thing a host who has guests has not done yet. */
function NextStep({ kind }: { kind: NextStepKind }) {
  const { t } = useTranslation();
  const step = NEXT_STEPS[kind];
  return (
    <NextStepCard
      data-testid="crm-next-step"
      data-step={kind}
      kicker={t('crm.nextStep.kicker')}
      title={t(step.titleKey)}
      detail={t(step.detailKey)}
      cta={{ label: t(step.ctaKey), href: step.href }}
    />
  );
}

/**
 * The guest list (NF-88, ADR-021): the guests of the properties the caller reaches, with their stays, spend, channels and the state of
 * their e-mail, under a strip of four numbers. The search, the filters and the order live in the address and are applied by the
 * server, inside the caller's scope; a row opens the guest. Whoever may write the campaigns also finds the ways to do it in the head of
 * the page, and, while there is no group or no campaign yet, the one next step. The page never shows or asks for a document, a birth
 * date or a birth place.
 */
export default function GuestList() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = useWorkspace();
  const canMarket = hasPermission('short-rent', 'marketing.manage');
  const { filters, params, activeCount, hasFilters, change, clear, searchOfPage } = useProfileFilters();
  const { data, isLoading, isError, error, refetch, isPlaceholderData } = useGuestCrmProfiles(params);
  const overview = useCrmOverview();
  const segments = useSegments(canMarket);
  const campaigns = useCampaigns(canMarket);
  const language = i18n.language;

  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 0;
  const lastPage = pageSize > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1;

  // A page that is not there any more (the last profile of it was merged): the list goes to the last one that is, instead of saying nothing.
  if (data && !isPlaceholderData && data.items.length === 0 && totalCount > 0 && filters.page > lastPage) {
    return <Navigate replace to={{ search: searchOfPage(lastPage) }} />;
  }

  const noGuestsAtAll = Boolean(data) && !isPlaceholderData && !hasFilters && totalCount === 0;
  let nextStep: NextStepKind | null = null;
  if (canMarket && !noGuestsAtAll && segments.data && campaigns.data) {
    if (segments.data.length === 0) nextStep = 'group';
    else if (campaigns.data.length === 0) nextStep = 'campaign';
  }

  const columns: DataColumn<CrmProfileListItem>[] = [
    { key: 'guest', header: t('crm.list.columns.guest'), rowHeader: true, cell: (profile) => <GuestCell profile={profile} /> },
    { key: 'stays', header: t('crm.list.columns.stays'), cell: (profile) => <StaysCell profile={profile} /> },
    { key: 'lastStay', header: t('crm.list.columns.lastStay'), cell: (profile) => <LastStayCell profile={profile} /> },
    { key: 'channels', header: t('crm.list.columns.channels'), cell: (profile) => <ChannelChips channels={profile.channels} /> },
    { key: 'email', header: t('crm.list.columns.email'), cell: (profile) => <EmailCell profile={profile} /> },
  ];

  const renderCard = (profile: CrmProfileListItem) => {
    const lastStay = formatDay(profile.lastStayAt, language);
    return (
      <ListCardBody
        title={<ProfileName profile={profile} />}
        content={{
          lead: <CrmAvatar name={profile.displayName} />,
          title: profile.displayName,
          sub: <Origin profile={profile} />,
          status: <ContactStateBadge state={emailStateOfProfile(profile)} />,
          meta: [
            {
              icon: CalendarCheck,
              label: t('crm.list.columns.stays'),
              text:
                profile.totalStays > 0
                  ? `${t('crm.list.staysCount', { count: profile.totalStays })} · ${formatMoney(profile.totalSpend, language)}`
                  : t('crm.list.noStays'),
            },
            ...(lastStay ? [{ icon: Clock, label: t('crm.list.columns.lastStay'), text: `${formatRelativeDay(profile.lastStayAt, language)} · ${lastStay}` }] : []),
            ...(profile.emailMasked ? [{ icon: Mail, label: t('crm.list.columns.email'), text: profile.emailMasked }] : []),
          ],
          foot: (
            <div className="space-y-2">
              <ChannelChips channels={profile.channels} />
              <TagChips tags={profile.tags} />
              {profile.hasMergeProposal ? <MergeMark /> : null}
            </div>
          ),
        }}
      />
    );
  };

  const noMatch = {
    icon: SearchX,
    title: t('crm.list.noMatch.title'),
    description: t('crm.list.noMatch.description'),
    action: { label: t('crm.list.noMatch.action'), onClick: clear },
  };

  return (
    <div className="min-w-0 space-y-6" data-testid="crm-guest-list">
      <PageHeader
        icon={Users}
        title={t('crm.list.title')}
        description={t('crm.list.description')}
        primary={canMarket ? { label: t('crm.list.actions.campaign'), icon: Send, to: NEW_CAMPAIGN_PATH, testId: 'crm-new-campaign' } : undefined}
        secondary={
          canMarket
            ? [
                { label: t('crm.list.actions.group'), icon: UsersRound, to: NEW_GROUP_PATH, testId: 'crm-new-group' },
                { label: t('crm.list.actions.import'), icon: Upload, to: IMPORT_PATH, testId: 'crm-import' },
              ]
            : undefined
        }
      />

      {overview && overview.guests > 0 ? <GuestOverview overview={overview} /> : null}

      {nextStep ? <NextStep kind={nextStep} /> : null}

      {noGuestsAtAll ? (
        <CrmEmptyState
          testId="crm-empty"
          icon={Users}
          title={t('crm.list.empty.title')}
          description={t('crm.list.empty.description')}
          action={canMarket ? { label: t('crm.list.empty.import'), href: IMPORT_PATH } : undefined}
          helpLink={{ label: t('crm.list.empty.help'), href: GUESTS_HELP_PATH }}
        />
      ) : (
        <>
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
              empty={hasFilters ? noMatch : undefined}
              testId="crm-profiles"
              footer={
                data && totalCount > 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3">
                    <p role="status" className="text-sm text-foreground/70" data-testid="crm-count">
                      {t('crm.list.count', { count: totalCount })}
                    </p>
                    <ListPagination page={filters.page} pageSize={pageSize} totalCount={totalCount} onPageChange={(page) => change({ page })} />
                  </div>
                ) : undefined
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
