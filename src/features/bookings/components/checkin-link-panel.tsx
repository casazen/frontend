import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Clock, Copy, Link2, Loader2, Send, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { getHttpStatus } from '@/lib/api-errors';
import { cn, copyTextToClipboard, formatDateTime } from '@/lib/utils';
import { getCheckInSessionStatusLabel } from '@/lib/i18n-labels';
import { useCheckInLinkDelivery } from '@/queries/use-checkin-link-delivery';
import {
  checkInEmailErrorLabel,
  useBookingCheckInSession,
  useCreateCheckInLink,
  useResendCheckInLink,
} from '@/queries/use-checkin';
import type { CheckInLinkDelivery } from '@/types/checkin-link.types';
import type { CheckInLinkResponse, CheckInSessionStatusDto, GuestCheckInSessionStatus } from '@/types/public-checkin.types';
import { describeDelivery, linkToCopy, type DeliveryLine, type DeliveryTone } from '../lib/checkin-link-delivery';

const STATUS_VARIANT: Record<GuestCheckInSessionStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Inviato: 'secondary',
  InCompilazione: 'outline',
  Completo: 'default',
  AlloggiatiInviato: 'default',
  Scaduto: 'destructive',
};

/** The icon and the tones of each kind of line about the delivery: an icon and a word always go together, the color is never the only signal. */
const DELIVERY_TONE: Record<DeliveryTone, { Icon: LucideIcon; icon: string; spin?: boolean }> = {
  done: { Icon: Check, icon: 'text-green-600' },
  working: { Icon: Loader2, icon: 'text-muted-foreground', spin: true },
  waiting: { Icon: Clock, icon: 'text-muted-foreground' },
  problem: { Icon: TriangleAlert, icon: 'text-destructive' },
};

/** Which of the two links of the panel was copied last: the one of the delivery («Copia link») or the one the host just generated. */
type CopiedLink = 'delivery' | 'issued' | null;

interface CheckInLinkPanelProps {
  bookingId: string;
  /** The host may generate and send links (booking.write). */
  canWrite: boolean;
}

/** State of the link email, as recorded by the API: never "sent" when nothing left (A5-26). */
function EmailState({ session }: { session: CheckInSessionStatusDto }) {
  const { t } = useTranslation();
  switch (session.emailStatus) {
    case 'Sent':
      return (
        <p className="text-sm text-muted-foreground" data-testid="checkin-link-email">
          {session.sentAt ? t('checkin.link.email.sentAt', { date: formatDateTime(session.sentAt) }) : t('checkin.link.email.sent')}
        </p>
      );
    case 'Queued':
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="checkin-link-email">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t('checkin.link.email.queued')}
        </p>
      );
    case 'Failed':
      return (
        <p className="text-sm text-destructive" role="alert" data-testid="checkin-link-email">
          {t('checkin.link.email.failed', { reason: checkInEmailErrorLabel(session.emailError, t) })}
        </p>
      );
    case 'NotRequested':
      return (
        <p className="text-sm text-muted-foreground" data-testid="checkin-link-email">
          {t('checkin.link.email.notRequested')}
        </p>
      );
    default:
      return null;
  }
}

interface DeliveryStateProps {
  delivery: CheckInLinkDelivery;
  line: DeliveryLine;
  /** The link to copy: only for who may copy one and only while the link waits for the host. */
  link: string | null;
  copied: boolean;
  /** A new link is being made or sent: it replaces this one, which stops working, so it is not offered to be copied meanwhile. */
  busy: boolean;
  onCopy: (link: string) => void;
}

/**
 * Where the link stands on its way to the guest (E23/F01/US02, NF-122): sent by e-mail or in the chat of the portal, on its way, waiting for something that is
 * not the host's to do (the chat of the portal, the conversation, the IP addresses) or failed, with the sentence that says why and, for who may copy it,
 * «Copia link». It never names who carries the message: it says «la chat del portale». A link that has not left is never shown as sent.
 */
function DeliveryState({ delivery, line, link, copied, busy, onCopy }: DeliveryStateProps) {
  const { t } = useTranslation();
  const { Icon, icon, spin } = DELIVERY_TONE[line.tone];

  return (
    <div className="space-y-2" role={line.tone === 'problem' ? 'alert' : 'status'} data-testid="checkin-delivery" data-state={delivery.state}>
      <p className={cn('flex items-start gap-2 text-sm font-medium', line.tone === 'problem' && 'text-destructive')} data-testid="checkin-delivery-state">
        <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', icon, spin && 'animate-spin motion-reduce:animate-none')} />
        <span>
          {t(line.labelKey)}
          {line.tone === 'done' && delivery.sentAt ? (
            <span className="font-normal text-muted-foreground"> {t('checkin.link.delivery.sentOn', { date: formatDateTime(delivery.sentAt) })}</span>
          ) : null}
        </span>
      </p>
      {line.hintKey ? (
        <p className="text-sm text-muted-foreground" data-testid="checkin-delivery-hint">
          {t(line.hintKey)}
        </p>
      ) : null}
      {link ? (
        <div className="space-y-1">
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-0" disabled={busy} onClick={() => onCopy(link)} data-testid="checkin-delivery-copy">
            {copied ? <Check className="mr-2 h-4 w-4 text-green-600" /> : <Copy className="mr-2 h-4 w-4" />}
            {t('checkin.copyLink')}
          </Button>
          <p className="text-xs text-muted-foreground">{t('checkin.link.delivery.carryIt')}</p>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Guest check-in link of a booking, host side (CO-09): status of the current link and of its email, a new link sent by
 * email (also the reminder) or generated to copy. The API returns the link whatever happens to the email, so a wrong
 * address or a provider error never leaves the host without a way to reach the guest.
 *
 * With the flags of the check-in link for portal bookings on (`portalChatCheckInLink`, `guestContactInfo`, E23/F01, NF-122) it also says where the link
 * stands on its way to a guest who has no e-mail address: sent in the chat of the portal, waiting for the chat, for the conversation or for the IP
 * addresses, or failed, and offers «Copia link» to who may copy a link (`booking.write`). With both off it reads and shows nothing of it.
 */
export function CheckInLinkPanel({ bookingId, canWrite }: CheckInLinkPanelProps) {
  const { t } = useTranslation();
  const { flags } = useFeatureFlags();
  const { data: session, isLoading, isError, refetch } = useBookingCheckInSession(bookingId);
  const delivery = useCheckInLinkDelivery(bookingId, flags.portalChatCheckInLink || flags.guestContactInfo);
  const resend = useResendCheckInLink(bookingId);
  const create = useCreateCheckInLink(bookingId);
  const [issued, setIssued] = useState<CheckInLinkResponse | null>(null);
  const [copied, setCopied] = useState<CopiedLink>(null);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="checkin-link-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('checkin.sessionLoading')}
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className="space-y-2" data-testid="checkin-link-error">
        <p className="text-sm text-destructive">{t('checkin.link.loadError')}</p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {t('checkin.link.retry')}
        </Button>
      </div>
    );
  }

  const status = session.status ?? null;
  const completed = status === 'Completo' || status === 'AlloggiatiInviato';
  const hasLink = status !== null && !completed;
  const busy = resend.isPending || create.isPending;

  // A booking that is gone (404) has no delivery, whatever the query still holds of it; any other failure is told, never taken for «nothing to say».
  const deliveryGone = delivery.isError && getHttpStatus(delivery.error) === 404;
  const deliveryData = deliveryGone ? undefined : delivery.data;
  const deliveryUnreadable = delivery.isError && !deliveryGone && !delivery.data;
  const deliveryLine = describeDelivery(deliveryData, { emailStatus: session.emailStatus, linkClosed: completed || status === 'Scaduto' });
  const deliveryLink = linkToCopy(deliveryData, deliveryLine, canWrite);
  // The line of the e-mail stays where it adds the real outcome of an e-mail the delivery handed to the queue (sent, still queued, refused by the provider); beside a link that
  // goes by the chat, or that waits, it would only say that no e-mail was sent, so it waits for the answer about the delivery instead of showing and then taking it back.
  const emailWasHandedOver = deliveryData?.channel === 'Email' && deliveryData.state === 'Sent';
  const showEmailState = hasLink && status !== 'Scaduto' && !delivery.isLoading && (deliveryLine === null || emailWasHandedOver);

  const copy = async (link: string, which: Exclude<CopiedLink, null>) => {
    try {
      await copyTextToClipboard(link);
      setCopied(which);
      toast.success(t('checkin.linkCopied'));
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error(t('checkin.link.copyFailed'));
    }
  };

  const onIssued = (data: CheckInLinkResponse) => {
    setCopied(null);
    setIssued(data);
  };

  return (
    <div className="space-y-3" data-testid="checkin-link-panel">
      <div className="flex flex-wrap items-center gap-2">
        {status ? (
          <Badge variant={STATUS_VARIANT[status] ?? 'secondary'} data-testid="checkin-session-badge">
            {getCheckInSessionStatusLabel(status, t)}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground" data-testid="checkin-session-none">
            {t('checkin.link.none')}
          </span>
        )}
        {hasLink && session.expiresAt && status !== 'Scaduto' && (
          <span className="text-xs text-muted-foreground" data-testid="checkin-link-expiry">
            {t('checkin.link.expiresAt', { date: formatDateTime(session.expiresAt) })}
          </span>
        )}
      </div>

      {completed && <p className="text-sm text-muted-foreground">{t('checkin.link.completed')}</p>}
      {deliveryData && deliveryLine ? (
        <DeliveryState
          delivery={deliveryData}
          line={deliveryLine}
          link={deliveryLink}
          copied={copied === 'delivery'}
          busy={busy}
          onCopy={(link) => void copy(link, 'delivery')}
        />
      ) : null}
      {deliveryUnreadable ? (
        <div className="space-y-2" data-testid="checkin-delivery-error">
          <p className="text-sm text-muted-foreground">{t('checkin.link.delivery.loadError')}</p>
          <Button variant="outline" size="sm" className="min-h-11 md:min-h-0" onClick={() => void delivery.refetch()}>
            {t('checkin.link.retry')}
          </Button>
        </div>
      ) : null}
      {showEmailState && <EmailState session={session} />}
      {status === 'Scaduto' && <p className="text-sm text-muted-foreground">{t('checkin.link.expired')}</p>}
      {!completed && !session.canIssueLink && (
        <p className="text-sm text-muted-foreground" data-testid="checkin-link-not-eligible">
          {t('checkin.link.notEligible')}
        </p>
      )}

      {issued && (
        <div className="space-y-1" data-testid="checkin-link-issued">
          <p className="text-sm font-medium">{t('checkin.link.copyTitle')}</p>
          <div className="flex items-center gap-2">
            <Input value={issued.checkInLink} readOnly className="font-mono text-xs" aria-label={t('checkin.link.copyTitle')} />
            <Button
              variant="outline"
              size="icon"
              onClick={() => void copy(issued.checkInLink, 'issued')}
              aria-label={t('checkin.copyLink')}
              data-testid="checkin-link-copy"
            >
              {copied === 'issued' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('checkin.link.copyHint', { date: formatDateTime(issued.expiresAt) })}
          </p>
        </div>
      )}

      {canWrite && session.canIssueLink && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => resend.mutate(undefined, { onSuccess: onIssued })}
              data-testid="checkin-resend-button"
            >
              {resend.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {status ? t('checkin.resendLink') : t('checkin.link.sendByEmail')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => create.mutate(undefined, { onSuccess: onIssued })}
              data-testid="checkin-generate-button"
            >
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
              {t('checkin.link.generateToCopy')}
            </Button>
          </div>
          {hasLink && status !== 'Scaduto' && (
            <p className="text-xs text-muted-foreground">{t('checkin.link.replaceWarning')}</p>
          )}
        </div>
      )}
    </div>
  );
}
