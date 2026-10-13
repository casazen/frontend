import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { todayInRome } from '@/lib/stay-dates';
import type { MarkVerifiedInput } from '@/api/ltr-reference-data.api';

interface Props {
  open: boolean;
  /** Name of what is being verified (comune and kind of data), for the title. */
  subject: string;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  /** Rejects on API errors (shown by the caller): the dialog then stays open. */
  onConfirm: (input: MarkVerifiedInput) => Promise<unknown>;
}

/**
 * "Segna verificato" (LT-13): the date of the check (today in Rome by default, never later) and the source it was
 * checked against. The backend stores both with the admin and keeps the previous values in the audit log. Mount it with
 * a `key` per target so the fields start empty for each one.
 */
export function LtrVerifyDialog({ open, subject, isSubmitting, onOpenChange, onConfirm }: Props) {
  const { t } = useTranslation();
  const [verifiedAt, setVerifiedAt] = useState(() => todayInRome());
  const [source, setSource] = useState('');
  const today = todayInRome();
  const valid = verifiedAt.length === 10 && verifiedAt <= today && source.trim().length > 0;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!valid) return;
    try {
      await onConfirm({ verifiedAt, source: source.trim() });
      onOpenChange(false);
    } catch {
      // Shown by the caller (toast); the dialog stays open.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{t('ltrReferenceData.verify.title', { subject })}</DialogTitle>
            <DialogDescription>{t('ltrReferenceData.verify.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="ltr-verified-at">{t('ltrReferenceData.verify.date')}</Label>
            <Input
              id="ltr-verified-at"
              type="date"
              max={today}
              value={verifiedAt}
              onChange={(e) => setVerifiedAt(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ltr-verification-source">{t('ltrReferenceData.verify.source')}</Label>
            <Textarea
              id="ltr-verification-source"
              value={source}
              maxLength={500}
              onChange={(e) => setSource(e.target.value)}
              placeholder={t('ltrReferenceData.verify.sourcePlaceholder')}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('ltrReferenceData.cancel')}
            </Button>
            <Button type="submit" disabled={!valid || isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('ltrReferenceData.verify.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
