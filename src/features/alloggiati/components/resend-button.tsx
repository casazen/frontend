import { Button } from '@/components/ui/button';
import { useResendAlloggiatiReport } from '@/queries/use-alloggiati';
import { Loader2, RefreshCw } from 'lucide-react';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';

interface ResendButtonProps {
  bookingId: string;
  status: AlloggiatiWebStatus;
}

export function ResendButton({ bookingId, status }: ResendButtonProps) {
  const resend = useResendAlloggiatiReport();

  if (status !== 'Failed') {
    return null;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => resend.mutate(bookingId)}
      disabled={resend.isPending}
      data-testid="alloggiati-resend-button"
    >
      {resend.isPending ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="mr-2 h-4 w-4" />
      )}
      Reinvia comunicazione
    </Button>
  );
}
