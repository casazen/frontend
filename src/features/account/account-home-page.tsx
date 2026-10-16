import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { ActivityList, FocusBlock, PlainSection, StatStrip, StatTile, type CalmAction } from '@/components/shared/calm';
import { Button } from '@/components/ui/button';
import { SkeletonCard, SkeletonLine } from '@/components/ui/skeleton';
import { getArea } from '@/config/areas';
import type { AppContextKey } from '@/config/route-manifest';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { getNavLabel } from '@/lib/nav-labels';
import { useOpenBillingPortal } from '@/queries/use-billing';
import { useOrgMembers, useOrgOverview } from '@/queries/use-org-team';
import type { OrgActivityEntry, OrgOverview } from '@/types/org-team.types';
import {
  ACCOUNT_ACTIVITY_PATH,
  ACCOUNT_PEOPLE_PATH,
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_PROPERTIES_PATH,
  activePeople,
  buildHomeItems,
  reachableEntry,
  type HomeItem,
  type Reach,
} from './account-home-model';
import { activityPhrase } from './activity-phrases';

/** The words of an item of the home: what it says and, when there is something to add, why or since when. */
function describeItem(item: HomeItem, t: TFunction): { title: string; body?: string } {
  switch (item.kind) {
    case 'billing':
      return { title: t('account.home.items.billing.title'), body: t('account.home.items.billing.body') };
    case 'invitations':
      return {
        title: t('account.home.items.invitations.title', { count: item.count }),
        body:
          item.days === null
            ? undefined
            : item.days === 0
              ? t('account.home.items.invitations.waitingToday')
              : t('account.home.items.invitations.waiting', { count: item.days }),
      };
    case 'properties':
      return { title: t('account.home.items.properties.title', { count: item.count }), body: t('account.home.items.properties.body') };
    case 'alloggiati':
      return { title: t('account.home.items.alloggiati.title', { count: item.count }), body: t('account.home.items.alloggiati.body') };
  }
}

/** The log sends UTC instants; one without a zone mark would be read as local time. */
function asInstant(when: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/i.test(when) ? when : `${when}Z`;
}

/**
 * Where "Niente di urgente" leads: the people or the properties of the account once those pages exist; until then the first area the
 * person works in, and the profile for who works in none.
 */
function onwardAction(reach: Reach, getDefaultRoute: (area: AppContextKey) => string, t: TFunction): CalmAction {
  const entry = reachableEntry([ACCOUNT_PEOPLE_PATH, ACCOUNT_PROPERTIES_PATH], reach);
  if (entry) return { label: t('account.home.open', { name: getNavLabel(entry, t) }), href: entry.path };

  const work = reach.contexts.find((context) => context.contextKey === 'short-rent' || context.contextKey === 'long-rent');
  if (work) return { label: t('account.home.open', { name: t(getArea(work.contextKey).nameKey) }), href: getDefaultRoute(work.contextKey) };

  return { label: t('account.home.open', { name: t('nav.profile') }), href: ACCOUNT_PROFILE_PATH };
}

/** A thing that waits for a look: a link to the page that solves it when there is one, otherwise only the sentence. */
function AttentionRow({ item, href }: { item: HomeItem; href: string | undefined }) {
  const { t } = useTranslation();
  const { title, body } = describeItem(item, t);
  const text = (
    <span className="min-w-0">
      <span className="block break-words font-medium">{title}</span>
      {body ? <span className="mt-0.5 block break-words text-sm text-foreground/70">{body}</span> : null}
    </span>
  );

  return (
    <li>
      {href !== undefined ? (
        <Link
          to={href}
          className="flex min-h-11 items-center justify-between gap-3 py-3 outline-hidden hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {text}
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      ) : (
        <div className="py-3">{text}</div>
      )}
    </li>
  );
}

function RecentActivity({ entries, reach }: { entries: OrgActivityEntry[]; reach: Reach }) {
  const { t } = useTranslation();
  const members = useOrgMembers(entries.length > 0);

  const names = useMemo(() => {
    const byUserId = new Map<string, string>();
    for (const member of members.data?.items ?? []) {
      byUserId.set(member.userId, [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email);
    }
    return byUserId;
  }, [members.data]);

  // Names that cannot be read would turn every person into a "former member": better no list than a wrong one.
  if (members.isError) return null;

  const logHref = reachableEntry([ACCOUNT_ACTIVITY_PATH], reach)?.path;
  const memberName = (userId: string) => names.get(userId);

  const list =
    entries.length === 0 ? (
      <p className="text-sm text-foreground/70">{t('account.home.activity.empty')}</p>
    ) : members.isPending ? (
      <SkeletonLine lines={3} label={t('account.home.loading')} />
    ) : (
      <ActivityList
        items={entries.map((entry) => ({
          id: entry.id,
          at: asInstant(entry.when),
          text: activityPhrase(entry, { t, memberName }),
          actor: entry.actorUserId ? (memberName(entry.actorUserId) ?? t('account.activity.formerMember')) : t('account.activity.system'),
        }))}
      />
    );

  return logHref ? (
    <PlainSection title={t('account.home.activity.title')} actionLabel={t('account.home.activity.seeAll')} href={logHref}>
      {list}
    </PlainSection>
  ) : (
    <PlainSection title={t('account.home.activity.title')}>{list}</PlainSection>
  );
}

function HomeBody({ overview }: { overview: OrgOverview }) {
  const { t } = useTranslation();
  const { contexts, hasPermission, getDefaultRoute } = useWorkspace();
  const portal = useOpenBillingPortal();
  const reach: Reach = { contexts, hasPermission };

  // What each item can do: the failed payment opens the billing portal of Stripe; the others lead to a page, if the page is there.
  const resolved: { item: HomeItem; action: CalmAction | null }[] = buildHomeItems(overview).map((item) => {
    const entry = item.kind === 'billing' ? undefined : reachableEntry(item.destinations, reach);
    const action: CalmAction | null =
      item.kind === 'billing'
        ? { label: t('account.home.items.billing.action'), onClick: () => portal.mutate(), loading: portal.isPending }
        : entry
          ? { label: t('account.home.open', { name: getNavLabel(entry, t) }), href: entry.path }
          : null;
    return { item, action };
  });

  // "Adesso" is the first thing that has a way out. One that has none yet waits below, as a sentence.
  const now = resolved.find((candidate): candidate is { item: HomeItem; action: CalmAction } => candidate.action !== null);
  const later = resolved.filter((candidate) => candidate !== now);
  const nowText = now ? describeItem(now.item, t) : null;

  const people = activePeople(overview);
  const peopleHref = reachableEntry([ACCOUNT_PEOPLE_PATH], reach)?.path;
  const propertiesHref = reachableEntry([ACCOUNT_PROPERTIES_PATH], reach)?.path;

  return (
    <div className="space-y-8">
      {now && nowText ? (
        <FocusBlock tone={now.item.tone} kicker={t('account.home.now')} title={nowText.title} body={nowText.body} primary={now.action} />
      ) : (
        <FocusBlock
          tone="success"
          kicker={t('account.home.now')}
          title={t('account.home.noUrgent.title')}
          body={t('account.home.noUrgent.body')}
          primary={onwardAction(reach, getDefaultRoute, t)}
        />
      )}

      {later.length > 0 ? (
        <PlainSection title={t('account.home.attention')} count={later.length}>
          <ul role="list" className="divide-y divide-border border-y border-border">
            {later.map(({ item, action }) => (
              <AttentionRow key={item.kind} item={item} href={action?.href} />
            ))}
          </ul>
        </PlainSection>
      ) : null}

      <StatStrip>
        {overview.seats && people !== null ? (
          <StatTile
            label={t('account.home.numbers.people')}
            value={people}
            delta={overview.seats.unlimited ? t('account.home.numbers.seatsUnlimited') : t('account.home.numbers.seatsOf', { count: overview.seats.max })}
            href={peopleHref}
          />
        ) : null}
        {overview.properties ? (
          <StatTile
            label={t('account.home.numbers.properties')}
            value={overview.properties.total}
            delta={t('account.home.numbers.byMode', { short: overview.properties.short, long: overview.properties.long })}
            href={propertiesHref}
          />
        ) : null}
      </StatStrip>

      {overview.recentActivity ? <RecentActivity entries={overview.recentActivity} reach={reach} /> : null}
    </div>
  );
}

/**
 * Home of the account area (AM-04): what asks for a look now, the few numbers of the account and what the team did lately, from the
 * one overview the backend gives to the owner and the administrators (`GET /api/orgs/me/overview`). A single highlighted block
 * (`FocusBlock`), the rest quiet. Every link is to a page that exists for this person; what the next tasks bring (people, the
 * properties of the account, the log) lights up here by itself when its page enters the route manifest.
 */
export function AccountHomePage() {
  const { t } = useTranslation();
  const overview = useOrgOverview();

  return (
    <div className="space-y-6">
      <PageHeader title={t('nav.accountHome')} description={t('account.home.description')} />

      {overview.data ? (
        <HomeBody overview={overview.data} />
      ) : overview.isError ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-destructive">{getProblemMessage(overview.error, t) ?? t('account.home.loadError')}</p>
          <Button type="button" variant="outline" onClick={() => void overview.refetch()}>
            {t('account.home.retry')}
          </Button>
        </div>
      ) : (
        <SkeletonCard lines={3} label={t('account.home.loading')} />
      )}
    </div>
  );
}
