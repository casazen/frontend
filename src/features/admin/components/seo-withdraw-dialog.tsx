import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useWithdrawSeoPage } from '@/queries/use-admin-seo';
import type { SeoPageAdmin } from '@/types/seo.types';
import { SEO_REVIEW_NOTE_MAX_LENGTH } from './seo-review-helpers';

interface SeoWithdrawDialogProps {
  /** Page to withdraw; null closes the dialog. Mount it with `key` so the note restarts for each page. */
  page: SeoPageAdmin | null;
  onClose: () => void;
}

/** Confirmation of "Ritira" (SE-01, A8-21): the page goes back to draft and leaves the public site and the sitemap. */
export function SeoWithdrawDialog({ page, onClose }: SeoWithdrawDialogProps) {
  const { t } = useTranslation();
  const withdrawMutation = useWithdrawSeoPage();
  const [note, setNote] = useState('');

  function handleWithdraw() {
    if (!page) return;
    const trimmed = note.trim();
    withdrawMutation.mutate(
      { pageId: page.id, body: trimmed ? { note: trimmed } : {} },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog open={page !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent data-testid="seo-withdraw-dialog">
        <DialogHeader>
          <DialogTitle>{t('admin.seo.withdrawDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.seo.withdrawDialog.description', { title: page?.title ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor="seo-withdraw-note">{t('admin.seo.withdrawDialog.noteLabel')}</Label>
          <Textarea
            id="seo-withdraw-note"
            value={note}
            maxLength={SEO_REVIEW_NOTE_MAX_LENGTH}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('admin.seo.withdrawDialog.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleWithdraw}
            disabled={withdrawMutation.isPending}
            data-testid="seo-withdraw-confirm"
          >
            {t('admin.seo.withdrawDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
