import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Copy, Link2, Loader2, Mail, RotateCw, Send, Wallet, type LucideIcon } from 'lucide-react';
import { WizardDone } from '@/components/shared/wizard/wizard-done';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useNow } from '@/hooks/use-now';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus, getProblemMessage, translateErrorCode } from '@/lib/api-errors';
import { formatStayDate } from '@/lib/stay-dates';
import { cn, copyTextToClipboard } from '@/lib/utils';
import { useBookingMirror, useCreatePaymentLink, useRetryOctorateSync } from '@/queries/use-bookings';
import { useProperties } from '@/queries/use-properties';
import { activeLink, portalName, splitGuestName, type NewBookingResult, type NewBookingValues } from '../lib/new-booking-model';
import {
  MIRROR_WATCH_MS,
  RETRY_GRACE_MS,
  mirrorLineOf,
  mirrorReadOf,
  nextStepOf,
  paymentLineOf,
  shouldWatchMirror,
  type MirrorLineKind,
  type NextStepKey,
  type PaymentLineKind,
} from '../lib/new-booking-result';

const BOOKINGS_PATH = '/app/short-rent/bookings';

/** How a line stands. It is said in words (a hidden label) and by an icon, never by a color alone. */
type Tone = 'done' | 'working' | 'problem' | 'todo';

const TONE_ICON: Record<Tone, LucideIcon> = {
  done: CheckCircle2,
  working: Loader2,
  problem: AlertTriangle,
  todo: Wallet,
};

const TONE_COLOR: Record<Tone, string> = {
  done: 'text-[color:var(--color-success-foreground,#166534)]',
  working: 'text-[color:var(--color-info-foreground,#1f4fa8)] motion-safe:animate-spin',
  problem: 'text-[color:var(--color-warning-foreground,#8a4b05)]',
  todo: 'text-foreground/70',
};

/** The words that say how a line stands, for who does not see the icon. The keys are written out so that the i18n test finds a missing translation. */
const TONE_LABEL_KEYS: Record<Tone, string> = {
  done: 'booking.create.done.state.done',
  working: 'booking.create.done.state.working',
  problem: 'booking.create.done.state.problem',
  todo: 'booking.create.done.state.todo',
};

interface ResultLineProps {
  testId: string;
  tone: Tone;
  title: string;
  /** The state the line is in (`data-state`), for the tests and for whoever reads the page. */
  state: string;
  children: ReactNode;
  action?: ReactNode;
}

/** One line of the result: what it is about, how it stands and, when the host can do something about it, the button. */
function ResultLine({ testId, tone, title, state, children, action }: ResultLineProps) {
  const { t } = useTranslation();
  const Icon = TONE_ICON[tone];

  return (
    <li className="flex min-w-0 items-start gap-3 py-3" data-testid={testId} data-state={state} data-tone={tone}>
      <Icon aria-hidden="true" className={cn('mt-0.5 size-5 shrink-0', TONE_COLOR[tone])} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="break-words text-sm font-semibold">
          {title}
          <span className="sr-only">: {t(TONE_LABEL_KEYS[tone])}</span>
        </p>
        <div className="space-y-1 break-words text-sm text-foreground/80">{children}</div>
        {action ? <div className="flex flex-wrap items-center gap-2 pt-1">{action}</div> : null}
      </div>
    </li>
  );
}

const MIRROR_TONE: Record<MirrorLineKind, Tone> = {
  pending: 'working',
  synced: 'done',
  failed: 'problem',
  conflict: 'problem',
  blocked: 'problem',
  waiting: 'problem',
  unreadable: 'problem',
  notFound: 'problem',
};

/** What each state of the channel manager says, in plain words. The keys are written out so that the i18n test finds a missing translation. */
const MIRROR_TEXT_KEYS: Record<MirrorLineKind, string> = {
  pending: 'booking.create.done.channelManager.pending',
  synced: 'booking.create.done.channelManager.synced',
  failed: 'booking.create.done.channelManager.failed',
  conflict: 'booking.create.done.channelManager.conflict',
  blocked: 'booking.create.done.channelManager.blocked',
  waiting: 'booking.create.done.channelManager.waiting',
  unreadable: 'booking.create.done.channelManager.unreadable',
  notFound: 'booking.create.done.channelManager.notFound',
};

const NEXT_STEP: Record<NextStepKey, { key: string; icon: LucideIcon }> = {
  retryChannelManager: { key: 'booking.create.done.next.retryChannelManager', icon: RotateCw },
  checkChannelManager: { key: 'booking.create.done.next.checkChannelManager', icon: AlertTriangle },
  sendPaymentLink: { key: 'booking.create.done.next.sendPaymentLink', icon: Link2 },
  recordIncome: { key: 'booking.create.done.next.recordIncome', icon: Wallet },
  checkIn: { key: 'booking.create.done.checkin', icon: Mail },
};

/** The payment link the host can still copy: it exists on this screen only (a credential: it is in no address, no draft and no cache that outlives it). */
interface IssuedLink {
  url: string;
  /** The e-mail to the guest was queued; `null` when it is not known (the answer of the creation does not say). */
  emailSent: boolean | null;
}

/**
 * "What happens now" after the booking was created, one line for each part with how it stands: the booking in CasaZen, the booking on the channel manager (only
 * for a property that is connected: it is created there after CasaZen has it, so the line goes from "being sent" to its outcome by itself, with «Retry» when it
 * failed) and how the guest pays (the payment link, to copy and to send again, or what the host does by hand). A part that is not completed is said as such,
 * never as done; the one next step the result suggests is the most urgent of them.
 */
export function NewBookingDone({ result, values }: { result: NewBookingResult; values: NewBookingValues }) {
  const { t, i18n } = useTranslation();
  const { booking, channelManager } = result;
  const { hasPermission } = useWorkspace();
  const connectorOn = useFeatureFlags().flags.octorateConnector;
  const properties = useProperties({ mode: 'short' });
  const propertyName =
    (Array.isArray(properties.data) ? properties.data : []).find((property) => property.id === values.propertyId)?.name ??
    booking.propertyName ??
    '';

  const day = (date: string) => formatStayDate(date, i18n.language, { day: 'numeric', month: 'long' });
  const from = day(values.checkInDate);
  const to = day(values.checkOutDate);
  const { firstName } = splitGuestName(values.guest.name);
  const guestName = firstName || t('booking.create.done.guestFallback');
  const fullName = values.guest.name.trim().replace(/\s+/g, ' ') || t('booking.create.done.guestFallback');
  const portal = activeLink(values);

  // The channel manager. Read only where it can be: a property that is mirrored (or not known to be), the connector on, and a caller who may read the
  // booking (a read they may not make would send them to the page of no access).
  const now = useNow(5_000);
  const [watch, setWatch] = useState(() => ({ since: Date.now(), retried: false }));
  const watchOver = now - watch.since >= MIRROR_WATCH_MS;
  const retrying = watch.retried && now - watch.since < RETRY_GRACE_MS;
  const mirrorOn = connectorOn && channelManager !== false && hasPermission('short-rent', 'booking.read');
  const detail = useBookingMirror(booking.id, {
    enabled: mirrorOn,
    keepWatching: (latest) => shouldWatchMirror({ sync: latest?.octorateSync ?? booking.octorateSync, expected: channelManager, watchOver, retrying }),
  });
  const sync = detail.data?.octorateSync ?? booking.octorateSync;
  const read = mirrorReadOf({ enabled: mirrorOn, isError: detail.isError, notFound: getHttpStatus(detail.error) === 404, hasData: detail.data !== undefined });
  const mirror = mirrorLineOf({ expected: channelManager, sync, read, watchOver, retrying });

  const retry = useRetryOctorateSync();
  const askAgain = () => retry.mutate({ id: booking.id }, { onSuccess: () => setWatch({ since: Date.now(), retried: true }) });
  // «Check again»: the result follows the channel manager for the time it waits once more, so that what the host asked for is not left to a second press.
  const checkAgain = () => {
    setWatch({ since: Date.now(), retried: false });
    void detail.refetch();
  };

  // The payment link.
  const [link, setLink] = useState<IssuedLink | null>(() => (booking.paymentLinkUrl ? { url: booking.paymentLinkUrl, emailSent: null } : null));
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle');
  const paymentLink = useCreatePaymentLink();
  const canWritePayments = hasPermission('short-rent', 'payment.write');
  const payment = paymentLineOf({ arrangement: values.paymentArrangement, portal: portal !== null, hasLink: link !== null });
  const makeLink = () =>
    paymentLink.mutate(booking.id, {
      onSuccess: (made) => {
        setCopy('idle');
        setLink({ url: made.paymentLinkUrl, emailSent: made.emailSent });
      },
    });
  const copyLink = async () => {
    if (!link) return;
    try {
      await copyTextToClipboard(link.url);
      setCopy('copied');
      setTimeout(() => setCopy('idle'), 2500);
    } catch {
      // The browser would not copy: the link is then shown in a field to select by hand.
      setCopy('failed');
    }
  };

  // The buttons of the card stay off while any of its requests is on its way: a second press would not be a second try, it would be a second link.
  const busy = retry.isPending || paymentLink.isPending;
  const next = NEXT_STEP[nextStepOf(mirror, payment)];

  return (
    <WizardDone
      title={t('booking.create.done.title', { name: fullName })}
      description={t('booking.create.done.description', { property: propertyName, from, to })}
      whatNext={[{ text: t(next.key, { name: guestName }), icon: next.icon }]}
      primary={{ label: t('booking.create.done.open'), to: `${BOOKINGS_PATH}/${booking.id}` }}
      secondary={{ label: t('booking.create.done.toList'), to: BOOKINGS_PATH }}
    >
      <ul className="divide-y rounded-lg border px-4" role="list" aria-live="polite" data-testid="booking-done-lines">
        <ResultLine testId="booking-done-booking" tone="done" state="created" title={t('booking.create.done.booking.title')}>
          <p>{t('booking.create.done.calendar', { from, to })}</p>
        </ResultLine>

        {mirror ? (
          <ResultLine
            testId="booking-done-channel-manager"
            tone={MIRROR_TONE[mirror.kind]}
            state={mirror.kind}
            title={t('booking.create.done.channelManager.title')}
            action={
              mirror.kind === 'waiting' || mirror.kind === 'unreadable' ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} loading={detail.isFetching} data-testid="booking-done-channel-manager-refresh" onClick={checkAgain}>
                  {t('booking.create.done.channelManager.refresh')}
                </Button>
              ) : mirror.canRetry ? (
                <Button type="button" size="sm" variant="outline" disabled={busy} loading={retry.isPending} data-testid="booking-done-channel-manager-retry" onClick={askAgain}>
                  <RotateCw aria-hidden="true" className="size-4" />
                  {t('booking.create.done.channelManager.retry')}
                </Button>
              ) : undefined
            }
          >
            <p>{t(MIRROR_TEXT_KEYS[mirror.kind])}</p>
            {mirror.reasonKey ? <p data-testid="booking-done-channel-manager-reason">{t(mirror.reasonKey)}</p> : null}
            {/* The refusal of the last «Retry», while there is still something to retry: once the state has moved on it is no longer the news. */}
            {retry.isError && (mirror.kind === 'failed' || mirror.kind === 'conflict') ? (
              <p role="alert" className="text-destructive" data-testid="booking-done-channel-manager-error">
                {getProblemMessage(retry.error, t) ?? t('booking.create.done.channelManager.retryFailed')}
              </p>
            ) : null}
          </ResultLine>
        ) : null}

        <PaymentLine
          kind={payment}
          portalName={portal ? portalName(portal.channel, t) : ''}
          link={link}
          copy={copy}
          error={booking.paymentLinkError}
          busy={busy}
          working={paymentLink.isPending}
          failure={paymentLink.isError ? (getProblemMessage(paymentLink.error, t) ?? t('booking.create.done.paymentLink.sendFailed')) : null}
          canSend={canWritePayments}
          onCopy={() => void copyLink()}
          onSend={makeLink}
        />
      </ul>
    </WizardDone>
  );
}

interface PaymentLineProps {
  kind: PaymentLineKind;
  portalName: string;
  link: IssuedLink | null;
  copy: 'idle' | 'copied' | 'failed';
  /** The code that stopped the link after the booking was written (`payment_link_unavailable`, `payment_provider_error`), if any. */
  error: string | null | undefined;
  busy: boolean;
  working: boolean;
  failure: string | null;
  canSend: boolean;
  onCopy: () => void;
  onSend: () => void;
}

/** How the guest pays: the link (to copy, and to send again: the new one replaces the old), what the host records by hand, or the portal that collects. */
function PaymentLine({ kind, portalName: portal, link, copy, error, busy, working, failure, canSend, onCopy, onSend }: PaymentLineProps) {
  const { t } = useTranslation();

  if (kind === 'portal') {
    return (
      <ResultLine testId="booking-done-payment" tone="todo" state="portal" title={t('booking.create.done.paymentTitle')}>
        <p>{t('booking.create.done.paymentPortal', { portal })}</p>
      </ResultLine>
    );
  }
  if (kind === 'onSite' || kind === 'bankTransfer') {
    return (
      <ResultLine testId="booking-done-payment" tone="todo" state={kind} title={t('booking.create.done.paymentTitle')}>
        <p>{t(kind === 'onSite' ? 'booking.create.done.paymentOnSite' : 'booking.create.done.paymentBankTransfer')}</p>
      </ResultLine>
    );
  }
  if (kind === 'none') {
    return (
      <ResultLine testId="booking-done-payment" tone="todo" state="none" title={t('booking.create.done.paymentTitle')}>
        <p>{t('booking.create.done.payment')}</p>
      </ResultLine>
    );
  }

  const sendButton = canSend ? (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={busy}
      loading={working}
      data-testid="booking-done-payment-send"
      onClick={onSend}
    >
      <Send aria-hidden="true" className="size-4" />
      {t(link ? 'booking.create.done.paymentLink.resend' : 'booking.create.done.paymentLink.send')}
    </Button>
  ) : undefined;

  if (kind === 'linkMissing') {
    // The booking is written and the guest got nothing: said as it is, with the reason the API gave, and the way to send it from here.
    const reason = translateErrorCode(error, t);
    return (
      <ResultLine testId="booking-done-payment" tone="problem" state="linkMissing" title={t('booking.create.done.paymentLink.title')} action={sendButton}>
        <p>{t('booking.create.done.paymentLink.missing')}</p>
        {reason ? <p data-testid="booking-done-payment-reason">{reason}</p> : null}
        {failure ? (
          <p role="alert" className="text-destructive" data-testid="booking-done-payment-error">
            {failure}
          </p>
        ) : null}
      </ResultLine>
    );
  }

  // The link was made. When the e-mail did not go out (known only after sending it again) the host is told to pass it on.
  const notEmailed = link?.emailSent === false;
  return (
    <ResultLine
      testId="booking-done-payment"
      tone={notEmailed ? 'problem' : 'done'}
      state={notEmailed ? 'linkNotEmailed' : 'linkSent'}
      title={t('booking.create.done.paymentLink.title')}
      action={
        <>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            data-testid="booking-done-payment-copy"
            onClick={onCopy}
          >
            <Copy aria-hidden="true" className="size-4" />
            {t(copy === 'copied' ? 'booking.create.done.paymentLink.copied' : 'booking.create.done.paymentLink.copy')}
          </Button>
          {sendButton}
        </>
      }
    >
      <p>{t(notEmailed ? 'booking.create.done.paymentLink.notEmailed' : 'booking.create.done.paymentLink.sent')}</p>
      {canSend ? <p className="text-xs text-foreground/70">{t('booking.create.done.paymentLink.resendHint')}</p> : null}
      {copy === 'failed' && link ? (
        <div className="space-y-1" data-testid="booking-done-payment-fallback">
          <p role="alert" className="text-destructive">
            {t('booking.create.done.paymentLink.copyFailed')}
          </p>
          <Input value={link.url} readOnly className="font-mono text-xs" aria-label={t('booking.create.done.paymentLink.field')} data-testid="booking-done-payment-field" onFocus={(event) => event.currentTarget.select()} />
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="text-destructive" data-testid="booking-done-payment-error">
          {failure}
        </p>
      ) : null}
    </ResultLine>
  );
}
