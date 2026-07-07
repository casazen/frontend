import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Send } from 'lucide-react';
import { useBookingCheckInSession, useResendCheckInLink } from '@/queries/use-checkin';
import type { GuestCheckInSessionStatus } from '@/types/public-checkin.types';

const STATUS_VARIANT: Record<GuestCheckInSessionStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  Inviato: 'secondary',
  InCompilazione: 'outline',
  Completo: 'default',
  AlloggiatiInviato: 'default',
  Scaduto: 'destructive',
};

export function CheckInSessionBadge({ bookingId }: { bookingId: string }) {
  const { t } = useTranslation();
  const { data: session, isLoading } = useBookingCheckInSession(bookingId);
  const resend = useResendCheckInLink(bookingId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('checkin.sessionLoading')}
      </div>
    );
  }

  if (!session?.status) {
    return <p className="text-sm text-muted-foreground" data-testid="checkin-session-none">{t('checkin.noSession')}</p>;
  }

  const status = session.status as GuestCheckInSessionStatus;
  const canResend = status !== 'Completo' && status !== 'AlloggiatiInviato';

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="checkin-session-badge">
      <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>
        {t(`checkin.status.${status}`, { defaultValue: status })}
      </Badge>
      {canResend && (
        <Button variant="outline" size="sm" onClick={() => resend.mutate()} disabled={resend.isPending} data-testid="checkin-resend-button">
          {resend.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {t('checkin.resendLink')}
        </Button>
      )}
    </div>
  );
}
