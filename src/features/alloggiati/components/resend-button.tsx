import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useResendAlloggiatiReport } from '@/queries/use-alloggiati';
import { Loader2, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';

interface ResendButtonProps {
  bookingId: string;
  status: AlloggiatiWebStatus;
}

function getButtonLabelKey(status: AlloggiatiWebStatus): string {
  switch (status) {
    case 'Submitted':
    case 'Confirmed':
      return 'alloggiati.sent';
    case 'Failed':
      return 'alloggiati.resend';
    case 'Pending':
    default:
      return 'alloggiati.send';
  }
}

function canSend(status: AlloggiatiWebStatus): boolean {
  return status !== 'Confirmed';
}

export function ResendButton({ bookingId, status }: ResendButtonProps) {
  const { t } = useTranslation();
  const resend = useResendAlloggiatiReport();
  const disabled = !canSend(status);

  const label = t(getButtonLabelKey(status));
  const isSent = status === 'Submitted' || status === 'Confirmed';

  return (
    <div className="relative inline-block" title={disabled ? t('alloggiati.alreadyConfirmed') : undefined}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => resend.mutate(bookingId)}
        disabled={disabled || resend.isPending}
        data-testid="alloggiati-resend-button"
      >
        {resend.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : isSent ? (
          <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
        ) : status === 'Failed' ? (
          <RefreshCw className="mr-2 h-4 w-4" />
        ) : (
          <Send className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
    </div>
  );
}
