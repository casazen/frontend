import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { PendingVerification } from '@/types/verification.types';
import { format, parseISO } from 'date-fns';
import { it, enUS } from 'date-fns/locale';
import {
  useRequestNewPhoto,
  useRecordVerification,
  useRejectVerification,
} from '@/queries/verification';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface VerificationItemProps {
  verification: PendingVerification;
}

export function VerificationItem({ verification }: VerificationItemProps) {
  const { t, i18n: i18nInstance } = useTranslation();
  const locale = i18nInstance.language === 'it' ? it : enUS;

  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');

  const requestNewPhoto = useRequestNewPhoto();
  const recordVerification = useRecordVerification();
  const rejectVerification = useRejectVerification();

  const handleRequestPhoto = () => {
    requestNewPhoto.mutate(verification.bookingId);
  };

  const handleVerify = (outcome: boolean) => {
    if (outcome) {
      // Accept verification
      recordVerification.mutate(
        {
          bookingId: verification.bookingId,
          data: { outcome: true, note: note || undefined },
        },
        {
          onSuccess: () => {
            setShowVerifyDialog(false);
            setNote('');
          },
        }
      );
    } else {
      // Reject verification (requires note)
      if (!note.trim()) {
        return;
      }
      recordVerification.mutate(
        {
          bookingId: verification.bookingId,
          data: { outcome: false, note },
        },
        {
          onSuccess: () => {
            setShowVerifyDialog(false);
            setNote('');
          },
        }
      );
    }
  };

  const handleReject = () => {
    if (!reason.trim()) {
      return;
    }
    rejectVerification.mutate(
      {
        bookingId: verification.bookingId,
        data: { reason },
      },
      {
        onSuccess: () => {
          setShowRejectDialog(false);
          setReason('');
        },
      }
    );
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'PPP', { locale });
    } catch {
      return dateString;
    }
  };

  const getReasonLabel = (outcome?: string) => {
    if (!outcome) {
      return t('verification.reason.unverified');
    }
    switch (outcome.toLowerCase()) {
      case 'escalate':
        return t('verification.reason.model_error');
      case 'reject':
        return t('verification.reason.consent_refused');
      default:
        return t('verification.reason.unverified');
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{verification.propertyName}</CardTitle>
          <CardDescription>
            {verification.guestName}
            {verification.guestEmail && ` • ${verification.guestEmail}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="font-medium text-muted-foreground">
                {t('verification.checkIn')}
              </div>
              <div>{formatDate(verification.checkInDate)}</div>
            </div>
            <div>
              <div className="font-medium text-muted-foreground">
                {t('verification.checkOut')}
              </div>
              <div>{formatDate(verification.checkOutDate)}</div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="font-medium text-muted-foreground text-sm">
              {t('verification.reason.label')}
            </div>
            <div className="text-sm">{getReasonLabel(verification.biometricOutcome)}</div>
          </div>
          <div className="space-y-1">
            <div className="font-medium text-muted-foreground text-sm">
              {t('verification.attempts')}
            </div>
            <div className="text-sm">{verification.biometricAttempts}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestPhoto}
              disabled={requestNewPhoto.isPending}
            >
              {t('verification.action.request_photo')}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowVerifyDialog(true)}
            >
              {t('verification.action.verify')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowRejectDialog(true)}
            >
              {t('verification.action.reject')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Verify Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('verification.dialog.verifyTitle')}</DialogTitle>
            <DialogDescription>
              {t('verification.dialog.verifyDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="verify-note">{t('verification.dialog.noteLabel')}</Label>
              <Textarea
                id="verify-note"
                placeholder={t('verification.dialog.notePlaceholder')}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVerifyDialog(false)}
              disabled={recordVerification.isPending}
            >
              {t('shared.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleVerify(false)}
              disabled={recordVerification.isPending || !note.trim()}
            >
              {t('verification.dialog.rejectButton')}
            </Button>
            <Button
              onClick={() => handleVerify(true)}
              disabled={recordVerification.isPending}
            >
              {t('verification.dialog.acceptButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('verification.dialog.rejectTitle')}</DialogTitle>
            <DialogDescription>
              {t('verification.dialog.rejectDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">{t('verification.dialog.reasonLabel')}</Label>
              <Textarea
                id="reject-reason"
                placeholder={t('verification.dialog.reasonPlaceholder')}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={rejectVerification.isPending}
            >
              {t('shared.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectVerification.isPending || !reason.trim()}
            >
              {t('verification.dialog.confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
