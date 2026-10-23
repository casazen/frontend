import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import type { InAppNotification } from '@/api/notifications.api';
import { useAppShell } from '@/components/layout/app-shell-context';
import { formatAbsolute, formatRelative } from '@/components/shared/timeline/timeline-time';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { isDemoMode } from '@/config/demo.config';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useUnreadNotificationCount,
} from '@/queries/use-notifications';
import { badgeText, notificationKind, notificationRoute } from './notification-model';
import { useNotificationsRealtime } from './use-notifications-realtime';

function relativeTime(createdAt: string, locale: string): string {
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return '';
  const now = new Date();
  return formatRelative(at, now, locale) ?? formatAbsolute(at, now, locale);
}

interface RowProps {
  notification: InAppNotification;
  onOpen: (notification: InAppNotification) => void;
}

function NotificationRow({ notification, onOpen }: RowProps) {
  const { t, i18n } = useTranslation();
  const { icon: Icon, textKey } = notificationKind(notification.type);
  const unread = notification.readAt === null;
  const when = relativeTime(notification.createdAt, i18n.language);

  return (
    <li>
      <button
        type="button"
        data-testid="notification-row"
        data-unread={unread || undefined}
        onClick={() => onOpen(notification)}
        className={cn(
          'flex min-h-14 w-full items-start gap-3 px-4 py-3 text-left text-sm outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          unread && 'bg-primary-soft/40',
        )}
      >
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/80">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block break-words', unread && 'font-semibold')}>{t(textKey)}</span>
          {when ? <time dateTime={notification.createdAt} className="block text-xs text-foreground/70">{when}</time> : null}
        </span>
        {unread ? (
          <span className="mt-2 shrink-0">
            <span aria-hidden="true" className="block size-2.5 rounded-full bg-primary" />
            <span className="sr-only">{t('notifications.unreadDot')}</span>
          </span>
        ) : null}
      </button>
    </li>
  );
}

/**
 * The notifications bell of the header (UI-12): the number of unread notifications on a badge and, in a popover, the list with the
 * most recent first. A click on a row marks it as read and opens the place it is about (the booking on its messages, the service
 * request); «Segna tutte come lette» marks all. The number is kept up to date by the real-time channel; a polite live region
 * announces when it grows, so a screen reader hears that something new arrived without the focus moving.
 */
export function NotificationBell() {
  const { isAuthenticated, kind, user, getAccessToken } = useAuth();
  // Only a signed-in user of the real app has a bell: a guest, a public page, the demo and a signed-out session have none (no
  // box, no request, no channel).
  const userId = user && 'sub' in user && typeof user.sub === 'string' ? user.sub : null;
  if (!isAuthenticated || kind !== 'auth0' || isDemoMode || userId === null) return null;
  return <LiveNotificationBell userId={userId} getAccessToken={getAccessToken} />;
}

function LiveNotificationBell({ userId, getAccessToken }: { userId: string; getAccessToken: () => Promise<string | undefined> }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const shell = useAppShell();
  const [open, setOpen] = useState(false);

  const channel = useNotificationsRealtime({ enabled: true, userId, getAccessToken });
  const count = useUnreadNotificationCount({ pollWhileDisconnected: channel !== 'connected' });
  const unread = count.data ?? 0;
  const list = useNotificationList(open);
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  // The announcement: only when the number grows after the first reading, never on load.
  const [seen, setSeen] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  if (count.isSuccess && unread !== seen) {
    setSeen(unread);
    if (seen !== null && unread > seen) setAnnouncement(t('notifications.unreadLive', { count: unread }));
    else if (unread === 0) setAnnouncement('');
  }

  const items = useMemo(() => list.data?.pages.flatMap((page) => (Array.isArray(page?.items) ? page.items : [])) ?? [], [list.data]);

  const openNotification = (notification: InAppNotification) => {
    if (notification.readAt === null) markRead.mutate(notification.id);
    setOpen(false);
    const route = notificationRoute(notification, shell?.contextKey ?? null);
    if (route) void navigate(route);
  };

  const label = unread > 0 ? t('notifications.bellWithCount', { count: unread }) : t('notifications.bell');

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid="notification-bell"
            aria-label={label}
            className="relative flex size-11 items-center justify-center rounded-lg text-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring md:size-10"
          >
            <Bell aria-hidden="true" className="size-5" />
            {unread > 0 ? (
              <span
                data-testid="notification-badge"
                aria-hidden="true"
                className="absolute right-0.5 top-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold leading-none text-primary-foreground ring-2 ring-background"
              >
                {badgeText(unread)}
              </span>
            ) : null}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="flex max-h-[min(32rem,calc(100dvh-6rem))] w-[26rem] flex-col p-0" data-testid="notification-panel">
          <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
            <h2 className="text-sm font-semibold">{t('notifications.title')}</h2>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              data-testid="notifications-mark-all"
            >
              <CheckCheck aria-hidden="true" className="mr-1.5 size-4" />
              {t('notifications.markAllRead')}
            </Button>
          </div>
          {markAll.isError ? (
            <p role="alert" className="border-b px-4 py-2 text-sm text-destructive">
              {t('notifications.markAllReadError')}
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {list.isPending ? (
              <p role="status" className="flex items-center gap-2 px-4 py-6 text-sm text-foreground/70">
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                {t('notifications.loading')}
              </p>
            ) : list.isError && items.length === 0 ? (
              <div role="alert" className="space-y-2 px-4 py-6 text-sm">
                <p className="text-destructive">{t('notifications.loadError')}</p>
                <Button type="button" variant="outline" size="sm" onClick={() => void list.refetch()}>
                  {t('notifications.retry')}
                </Button>
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-sm text-foreground/70" data-testid="notifications-empty">
                {t('notifications.empty')}
              </p>
            ) : (
              <ul aria-label={t('notifications.listLabel')} className="divide-y">
                {items.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} onOpen={openNotification} />
                ))}
              </ul>
            )}
            {list.hasNextPage ? (
              <div className="border-t p-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  disabled={list.isFetchingNextPage}
                  onClick={() => void list.fetchNextPage()}
                  data-testid="notifications-load-more"
                >
                  {list.isFetchingNextPage ? t('notifications.loadingMore') : t('notifications.loadMore')}
                </Button>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only" data-testid="notifications-live">
        {announcement}
      </span>
    </>
  );
}
