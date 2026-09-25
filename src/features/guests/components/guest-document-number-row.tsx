import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { guestsApi } from '@/api/guests.api';
import { getProblemMessage } from '@/lib/api-errors';

/**
 * Document number of the guest: masked by the API (CO-14); "Show" asks the full number to the audited endpoint and
 * keeps it only in this component's state.
 */
export function GuestDocumentNumberRow({ guestId, masked }: { guestId: string; masked: string }) {
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState<string | null>(null);
  const reveal = useMutation({
    mutationFn: () => guestsApi.getDocumentNumber(guestId),
    onSuccess: (result) => setRevealed(result.documentNumber),
    onError: (error) => {
      toast.error(getProblemMessage(error, t) ?? t('guests.documentNumberRevealFailed'));
    },
  });

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{t('guests.documentNumber')}</span>
      <span className="flex items-center gap-2">
        <span className="font-medium font-mono" data-testid="guest-document-number">
          {revealed ?? masked}
        </span>
        {revealed ? (
          <Button variant="ghost" size="sm" onClick={() => setRevealed(null)} data-testid="guest-document-number-hide">
            <EyeOff className="mr-1 h-3.5 w-3.5" />
            {t('guests.documentNumberHide')}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => reveal.mutate()}
            disabled={reveal.isPending}
            data-testid="guest-document-number-show"
          >
            {reveal.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1 h-3.5 w-3.5" />}
            {t('guests.documentNumberShow')}
          </Button>
        )}
      </span>
    </div>
  );
}
