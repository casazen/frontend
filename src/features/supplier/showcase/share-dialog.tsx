import { useTranslation } from 'react-i18next';
import { Copy, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { shareMessage } from './showcase-model';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The absolute address of the showcase. */
  url: string;
  bookingsOpen: boolean;
}

/**
 * "Condividi": the link to copy, and a message ready to send by WhatsApp or by e-mail. Nothing is sent from here: WhatsApp and the mail
 * program open with the text written and the supplier sends it (or not). No QR code (decision VT-D15: no new dependency).
 */
export function ShareDialog({ open, onOpenChange, url, bookingsOpen }: ShareDialogProps) {
  const { t } = useTranslation();
  const message = shareMessage(url, bookingsOpen, t);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t('supplier.showcase.linkCopied'));
    } catch {
      toast.error(t('supplier.showcase.linkCopyError'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="supplier-showcase-share">
        <DialogHeader>
          <DialogTitle>{t('supplier.showcase.share.title')}</DialogTitle>
          <DialogDescription>{t('supplier.showcase.share.description')}</DialogDescription>
        </DialogHeader>
        <p className="break-all rounded-md bg-muted px-3 py-2 text-sm" data-testid="supplier-showcase-share-url">
          {url}
        </p>
        <blockquote className="whitespace-pre-line rounded-md border-l-4 border-primary bg-muted/50 px-3 py-2 text-sm">{message}</blockquote>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button type="button" variant="outline" onClick={() => void copy(url)}>
            <Copy className="mr-1 h-4 w-4" aria-hidden="true" />
            {t('supplier.showcase.copyLink')}
          </Button>
          <Button asChild variant="outline">
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('supplier.showcase.share.whatsapp')}
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`mailto:?subject=${encodeURIComponent(t('supplier.showcase.share.subject'))}&body=${encodeURIComponent(message)}`}>
              <Mail className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('supplier.showcase.share.email')}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
