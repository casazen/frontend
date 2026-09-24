import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Check, Copy, Link2, Loader2, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { copyTextToClipboard, formatDateTime } from '@/lib/utils';
import { getCheckInSessionStatusLabel } from '@/lib/i18n-labels';
import {
  checkInEmailErrorLabel,
  useBookingCheckInSession,
  useCreateCheckInLink,
  useResendCheckInLink,
} from '@/queries/use-checkin';
import type { CheckInLinkResponse, CheckInSessionStatusDto, GuestCheckInSessionStatus } from '@/types/public-checkin.types';

const STATUS_VARIANT: Record<GuestCheckInSessionStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Inviato: 'secondary',
  InCompilazione: 'outline',
  Completo: 'default',
  AlloggiatiInviato: 'default',
  Scaduto: 'destructive',
};

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

/**
 * Guest check-in link of a booking, host side (CO-09): status of the current link and of its email, a new link sent by
 * email (also the reminder) or generated to copy. The API returns the link whatever happens to the email, so a wrong
 * address or a provider error never leaves the host without a way to reach the guest.
 */
export function CheckInLinkPanel({ bookingId, canWrite }: CheckInLinkPanelProps) {
  const { t } = useTranslation();
  const { data: session, isLoading, isError, refetch } = useBookingCheckInSession(bookingId);
  const resend = useResendCheckInLink(bookingId);
  const create = useCreateCheckInLink(bookingId);
  const [issued, setIssued] = useState<CheckInLinkResponse | null>(null);
  const [copied, setCopied] = useState(false);

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

  const copy = async (link: string) => {
    try {
      await copyTextToClipboard(link);
      setCopied(true);
      toast.success(t('checkin.linkCopied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('checkin.link.copyFailed'));
    }
  };

  const onIssued = (data: CheckInLinkResponse) => {
    setCopied(false);
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
      {hasLink && status !== 'Scaduto' && <EmailState session={session} />}
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
              onClick={() => void copy(issued.checkInLink)}
              aria-label={t('checkin.copyLink')}
              data-testid="checkin-link-copy"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
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
