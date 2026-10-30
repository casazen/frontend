import { useState, type ComponentProps } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Copy, ExternalLink, PauseCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { FOCUS_COLUMN } from '@/components/layout/page-columns';
import { PageHeader } from '@/components/layout/page-header';
import { FocusBlock, PlainSection, StatStrip, StatTile, type CalmAction } from '@/components/shared/calm';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { ErrorState } from '@/components/shared/error-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { formatRomeDateTime } from '@/lib/stay-dates';
import { toastUndo } from '@/lib/toast-undo';
import { cn } from '@/lib/utils';
import {
  useDiscardShowcaseChanges,
  usePauseShowcase,
  useResumeShowcase,
  useShowcaseContent,
  useShowcaseStats,
} from '@/queries/supplier/use-showcase';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { ShareDialog } from './share-dialog';
import {
  bookingsReasonKey,
  changeLabelKey,
  editorStepOf,
  EDITOR_STEPS,
  firstFixable,
  fixPathOf,
  itemsToFix,
  PAYMENTS_SETTINGS_PATH,
  stateView,
  stepPath,
} from './showcase-model';
import { ShowcaseWorkPage } from './showcase-work-page';
import { useShowcasePublish } from './use-showcase-publish';

/** The badge of the state: a word and an icon, never a color alone. */
const BADGE_TONE = {
  neutral: 'bg-muted text-foreground ring-border',
  success: 'bg-success-soft text-success-foreground ring-success-border',
  warning: 'bg-warning-soft text-warning-foreground ring-warning-border',
  info: 'bg-info-soft text-info-foreground ring-info-border',
} as const;

function StateBadge({ content }: { content: ShowcaseContent }) {
  const { t } = useTranslation();
  const view = stateView(content.state);
  const Icon = content.state === 'Paused' ? PauseCircle : content.state === 'Online' ? CheckCircle2 : AlertCircle;
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset', BADGE_TONE[view.tone])}
      data-testid="supplier-showcase-state"
      data-state={content.state}
    >
      <Icon className="size-4" aria-hidden="true" />
      {t(view.labelKey)}
    </span>
  );
}

/**
 * "Il mio sito vetrina", the overview (SP-13c): where the showcase stands (draft, online, changes to publish, paused), the one thing to do
 * now, its address with the ways to share it, what is missing or what a publication would change, the two true numbers and the settings
 * (pause, throw the changes away). **One** highlighted block: what it asks depends on the state. Publishing and pausing can be taken
 * back from the toast that follows; throwing the changes away asks first and says what it does.
 */
export function SupplierShowcaseHubPage() {
  const { t, i18n } = useTranslation();
  const [params] = useSearchParams();
  const content = useShowcaseContent();
  const stats = useShowcaseStats();
  const publish = useShowcasePublish();
  const discard = useDiscardShowcaseChanges();
  const pause = usePauseShowcase();
  const resume = useResumeShowcase();
  const [shareOpen, setShareOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  const header = <PageHeader title={t('supplier.showcase.title')} description={t('supplier.showcase.description')} crumbs="auto" />;

  if (content.isError) {
    return (
      <div className={cn(FOCUS_COLUMN, 'space-y-6')}>
        {header}
        <ErrorState testId="supplier-showcase-error" title={t('supplier.showcase.loadError')} error={content.error} onRetry={() => void content.refetch()} />
      </div>
    );
  }
  if (content.isLoading || !content.data) return <LoadingScreen message={t('supplier.showcase.loading')} className="h-auto flex-1" />;

  // `?step=` opens the work view: the panels with the live preview beside them.
  const step = editorStepOf(params.get('step'));
  if (step) return <ShowcaseWorkPage content={content.data} step={step} />;

  const data = content.data;
  const busy = publish.isPending || pause.isPending || resume.isPending || discard.isPending;
  const toFix = itemsToFix(data);
  const fixable = firstFixable(data);
  const url = data.publicUrl;
  const when = (iso: string | null) => (iso ? formatRomeDateTime(iso, i18n.language) : '');

  const fail = (error: unknown, fallbackKey: string) => toast.error(getProblemMessage(error, t) ?? t(fallbackKey));

  const runPublish = () => publish.run(data.version);

  const runPause = () =>
    pause.mutate(undefined, {
      onSuccess: () =>
        toastUndo(t('supplier.showcase.toast.paused'), {
          undo: async () => {
            await resume.mutateAsync();
          },
        }),
      onError: (error) => fail(error, 'supplier.showcase.toast.pauseFailed'),
    });

  const runResume = () =>
    resume.mutate(undefined, {
      onSuccess: (updated) =>
        toastUndo(t('supplier.showcase.toast.resumed'), {
          description: updated.bookings.open ? t('supplier.showcase.toast.bookingsOpen') : undefined,
          undo: async () => {
            await pause.mutateAsync();
          },
        }),
      onError: (error) => fail(error, 'supplier.showcase.toast.resumeFailed'),
    });

  const openPublic = () => {
    if (data.publicPath) window.open(data.publicPath, '_blank', 'noopener');
  };

  const copyLink = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('supplier.showcase.linkCopied'));
    } catch {
      toast.error(t('supplier.showcase.linkCopyError'));
    }
  };

  // The one block that is highlighted: it asks for what the state asks.
  const fixAction: CalmAction = fixable
    ? { label: t('supplier.showcase.focus.fix', { item: t(`supplier.showcase.readiness.${fixable.item.code}`) }), href: fixable.path }
    : { label: t('supplier.showcase.focus.refresh'), onClick: () => void content.refetch() };
  const publishAction = (label: string): CalmAction => ({ label, onClick: runPublish, loading: publish.isPending });
  const editAction: CalmAction = { label: t('supplier.showcase.focus.edit'), href: stepPath(EDITOR_STEPS[0]) };
  const changesList = data.changes
    .map((member) => {
      const key = changeLabelKey(member);
      return key ? t(key) : member;
    })
    .join(', ');

  let focus: ComponentProps<typeof FocusBlock>;
  if (data.state === 'Paused') {
    focus = {
      tone: 'info',
      kicker: t('supplier.showcase.focus.now'),
      title: t('supplier.showcase.focus.pausedTitle'),
      body: t('supplier.showcase.focus.pausedBody'),
      primary: { label: t('supplier.showcase.focus.resume'), onClick: runResume, loading: resume.isPending },
      secondary: editAction,
    };
  } else if (data.state === 'ChangesReady') {
    focus = {
      tone: data.readiness.canPublish ? 'neutral' : 'warning',
      kicker: t('supplier.showcase.focus.now'),
      title: t('supplier.showcase.focus.changesTitle'),
      body: t('supplier.showcase.focus.changesBody', { changes: changesList }),
      primary: data.readiness.canPublish ? publishAction(t('supplier.showcase.focus.publishChanges')) : fixAction,
      secondary: editAction,
    };
  } else if (data.state === 'Online') {
    focus = {
      tone: 'success',
      title: t('supplier.showcase.focus.onlineTitle'),
      body: data.bookings.open ? t('supplier.showcase.focus.onlineBookingsOpen') : t('supplier.showcase.focus.onlineReadOnly'),
      when: data.publishedAt ? t('supplier.showcase.focus.publishedAt', { when: when(data.publishedAt) }) : undefined,
      primary: editAction,
      secondary: { label: t('supplier.showcase.focus.open'), onClick: openPublic },
    };
  } else {
    focus = {
      tone: data.readiness.canPublish ? 'neutral' : 'warning',
      kicker: t('supplier.showcase.focus.now'),
      title: data.readiness.canPublish ? t('supplier.showcase.focus.publishTitle') : t('supplier.showcase.focus.missingTitle'),
      body: data.readiness.canPublish ? t('supplier.showcase.focus.publishBody') : t('supplier.showcase.focus.missingBody'),
      primary: data.readiness.canPublish ? publishAction(t('supplier.showcase.focus.publish')) : fixAction,
      secondary: editAction,
    };
  }

  const reasonKey = bookingsReasonKey(data.bookings.blockedBy);
  const secondary = [
    ...(data.state === 'Online' || data.state === 'ChangesReady'
      ? [{ label: t('supplier.showcase.settings.pause'), hint: t('supplier.showcase.settings.pauseHint'), onClick: runPause, testId: 'supplier-showcase-pause' }]
      : []),
    ...(data.state === 'Online' && data.bookings.blockedBy.length === 1 && data.bookings.blockedBy[0] === 'bookings_off'
      ? [{ label: t('supplier.showcase.settings.openBookings'), hint: t('supplier.showcase.settings.openBookingsHint'), onClick: runResume, testId: 'supplier-showcase-open-bookings' }]
      : []),
    ...(data.changes.length > 0 && data.state !== 'Draft'
      ? [{ label: t('supplier.showcase.settings.discard'), hint: t('supplier.showcase.settings.discardHint'), onClick: () => setDiscardOpen(true), testId: 'supplier-showcase-discard' }]
      : []),
  ];

  return (
    <div className={cn(FOCUS_COLUMN, 'space-y-6')} data-testid="supplier-showcase-hub">
      {header}
      <div className="flex flex-wrap items-center gap-3">
        <StateBadge content={data} />
        {data.savedAt && data.state !== 'Online' ? (
          <span className="text-sm text-foreground/70">{t('supplier.showcase.savedAt', { when: when(data.savedAt) })}</span>
        ) : null}
      </div>

      <FocusBlock {...focus} data-testid="supplier-showcase-focus" />

      {url || data.publicPath ? (
        <PlainSection title={t('supplier.showcase.address.title')} data-testid="supplier-showcase-address">
          <p className="break-all text-sm" data-testid="supplier-showcase-url">
            {url ?? t('supplier.showcase.noPublicUrl')}
          </p>
          {data.state === 'Draft' ? <p className="text-sm text-foreground/70">{t('supplier.showcase.address.draftNote')}</p> : null}
          <div className="flex flex-wrap gap-2 pt-1">
            {data.publicPath && data.state !== 'Draft' ? (
              <Button type="button" variant="outline" size="sm" onClick={openPublic}>
                <ExternalLink className="mr-1 h-4 w-4" aria-hidden="true" />
                {t('supplier.showcase.open')}
              </Button>
            ) : null}
            {url ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => void copyLink()}>
                  <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t('supplier.showcase.copyLink')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShareOpen(true)} data-testid="supplier-showcase-share-open">
                  <Share2 className="mr-1 h-4 w-4" aria-hidden="true" />
                  {t('supplier.showcase.share.open')}
                </Button>
              </>
            ) : null}
          </div>
        </PlainSection>
      ) : null}

      {toFix.length > 0 || (data.changes.length > 0 && data.state !== 'Draft') ? (
        <PlainSection title={t('supplier.showcase.before.title')} data-testid="supplier-showcase-missing">
          {data.state !== 'Draft' && data.changes.length > 0 ? (
            <p className="text-sm" data-testid="supplier-showcase-changes">
              {t('supplier.showcase.before.changes', { changes: changesList })}
            </p>
          ) : null}
          {toFix.length > 0 ? (
            <ul className="space-y-2" aria-label={t('supplier.showcase.before.missing')}>
              {toFix.map((item) => {
                const path = fixPathOf(item);
                return (
                  <li key={item.code} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" data-testid={`supplier-showcase-todo-${item.code}`}>
                    <span className={cn('font-medium', item.required && 'text-warning-foreground')}>
                      {item.required ? t('supplier.showcase.before.required') : t('supplier.showcase.before.advised')}
                    </span>
                    <span className="min-w-0 break-words">{t(`supplier.showcase.readiness.${item.code}`)}</span>
                    {path ? (
                      <Link className="inline-flex min-h-11 items-center font-medium underline underline-offset-4" to={path}>
                        {t('supplier.showcase.before.fix')}
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
        </PlainSection>
      ) : null}

      {(data.state === 'Online' || data.state === 'ChangesReady') && !data.bookings.open && reasonKey ? (
        <PlainSection title={t('supplier.showcase.bookings.title')} data-testid="supplier-showcase-bookings">
          <p className="text-sm">{t(reasonKey)}</p>
          {data.bookings.blockedBy.includes('payments_account_not_ready') ? (
            <Button asChild variant="outline" size="sm">
              <Link to={PAYMENTS_SETTINGS_PATH}>{t('supplier.showcase.bookings.goToPayments')}</Link>
            </Button>
          ) : null}
        </PlainSection>
      ) : null}

      {secondary.length > 0 ? (
        <PlainSection title={t('supplier.showcase.settings.title')} data-testid="supplier-showcase-settings">
          <ul className="divide-y">
            {secondary.map((action) => (
              <li key={action.testId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                <p className="min-w-0 flex-1 basis-60 text-sm text-foreground/80">{action.hint}</p>
                <Button type="button" variant="outline" size="sm" disabled={busy} onClick={action.onClick} data-testid={action.testId}>
                  {action.label}
                </Button>
              </li>
            ))}
          </ul>
        </PlainSection>
      ) : null}

      {stats.data ? (
        <StatStrip label={t('supplier.showcase.stats.label')} data-testid="supplier-showcase-stats">
          <StatTile label={t('supplier.showcase.stats.requests', { days: stats.data.days })} value={stats.data.requests} />
          <StatTile
            label={t('supplier.showcase.stats.pending')}
            value={stats.data.pending}
            tone={stats.data.pending > 0 ? 'warning' : 'neutral'}
            href={stats.data.pending > 0 ? '/app/supplier/inbox' : undefined}
          />
        </StatStrip>
      ) : null}

      {url ? <ShareDialog open={shareOpen} onOpenChange={setShareOpen} url={url} bookingsOpen={data.bookings.open} /> : null}
      <ConfirmationDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={t('supplier.showcase.discardDialog.title')}
        description={t('supplier.showcase.discardDialog.description')}
        consequences={[t('supplier.showcase.discardDialog.lost'), t('supplier.showcase.discardDialog.kept')]}
        confirmLabel={t('supplier.showcase.settings.discard')}
        variant="destructive"
        isLoading={discard.isPending}
        onConfirm={async () => {
          try {
            await discard.mutateAsync(data.version);
            setDiscardOpen(false);
            toast.success(t('supplier.showcase.toast.discarded'));
          } catch (error) {
            fail(error, 'supplier.showcase.toast.discardFailed');
          }
        }}
      />
    </div>
  );
}
