import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, ExternalLink, MinusCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PendingVerification, VerificationReason } from '@/types/verification.types';
import { formatStayDate, parseStayDate } from '@/lib/stay-dates';
import {
  useRequestNewPhoto,
  useRecordVerification,
  useRejectVerification,
} from '@/queries/verification';
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
import { checkKey, figuresOf, queueReasonOf, resultKey, resultTone, type ResultTone } from './verification-model';

interface VerificationItemProps {
  verification: PendingVerification;
}

const TONE_ICON: Record<ResultTone, { Icon: typeof CheckCircle2; className: string }> = {
  passed: { Icon: CheckCircle2, className: 'text-green-700' },
  skipped: { Icon: MinusCircle, className: 'text-muted-foreground' },
  attention: { Icon: AlertTriangle, className: 'text-amber-700' },
};

/** One check of the automatic outcome in plain words: which check, what it found and, when it has them, the value and the threshold. */
function ReasonLine({ reason }: { reason: VerificationReason }) {
  const { t, i18n } = useTranslation();
  const { Icon, className } = TONE_ICON[resultTone(reason.result)];
  const figures = figuresOf(reason, i18n.language);

  return (
    <li className="flex items-start gap-2 text-sm" data-testid="verification-reason">
      <Icon aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${className}`} />
      <span>
        <span className="font-medium">{t(checkKey(reason.check), { code: reason.check })}</span>
        {': '}
        {t(resultKey(reason.result), { code: reason.result })}
        {figures && <span className="text-muted-foreground"> ({t(figures.key, figures.values)})</span>}
      </span>
    </li>
  );
}

export function VerificationItem({ verification }: VerificationItemProps) {
  const { t, i18n } = useTranslation();

  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');

  const requestNewPhoto = useRequestNewPhoto();
  const recordVerification = useRecordVerification();
  const rejectVerification = useRejectVerification();
  // One write of this card at a time: whatever is in flight, none of its buttons can start another.
  const busy = requestNewPhoto.isPending || recordVerification.isPending || rejectVerification.isPending;

  const handleRequestPhoto = () => {
    if (busy) return;
    requestNewPhoto.mutate(verification.bookingId);
  };

  const handleVerify = (outcome: boolean) => {
    if (busy) return;
    if (outcome) {
      // Approve: the note is optional.
      recordVerification.mutate(
        {
          bookingId: verification.bookingId,
          data: { outcome: true, note: note.trim() || undefined },
        },
        {
          onSuccess: () => {
            setShowVerifyDialog(false);
            setNote('');
          },
        }
      );
    } else {
      // Not verified: the note is required.
      if (!note.trim()) {
        return;
      }
      recordVerification.mutate(
        {
          bookingId: verification.bookingId,
          data: { outcome: false, note: note.trim() },
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
    if (busy || !reason.trim()) {
      return;
    }
    rejectVerification.mutate(
      {
        bookingId: verification.bookingId,
        data: { reason: reason.trim() },
      },
      {
        onSuccess: () => {
          setShowRejectDialog(false);
          setReason('');
        },
      }
    );
  };

  const stayDate = (value: string) => {
    const day = parseStayDate(value);
    return day ? formatStayDate(day, i18n.language) : value;
  };

  const why = queueReasonOf(verification);
  const reasons = verification.reasons ?? [];
  const provisional = verification.provisional === true;
  const email = verification.guestEmail?.trim();

  return (
    <>
      <Card data-testid="verification-item">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-1.5">
              {/* A heading of the level below the title of the page (the card title of the kit is an h3). */}
              <h2 className="text-xl font-semibold leading-none tracking-tight">{verification.propertyName}</h2>
              <CardDescription>
                {t('verification.arrivalDeparture', {
                  arrival: stayDate(verification.checkInDate),
                  departure: stayDate(verification.checkOutDate),
                })}
              </CardDescription>
            </div>
            {provisional && (
              <Badge variant="warning" data-testid="verification-provisional">
                {t('verification.provisional.badge')}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div className="space-y-0.5 sm:col-span-2">
              <dt className="font-medium text-muted-foreground">{t('verification.why.title')}</dt>
              <dd data-testid="verification-why" data-reason={why}>
                {t(`verification.why.${why}`)}
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="font-medium text-muted-foreground">{t('verification.attempts')}</dt>
              <dd>{verification.biometricAttempts}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="font-medium text-muted-foreground">{t('verification.guest.title')}</dt>
              <dd className="break-words">
                {verification.guestName}
                {email && (
                  <>
                    {' · '}
                    <a className="underline underline-offset-2" href={`mailto:${email}`} data-testid="verification-guest-email">
                      {email}
                    </a>
                  </>
                )}
              </dd>
            </div>
          </dl>

          {reasons.length > 0 && (
            <div className="space-y-2" data-testid="verification-checks">
              <p className="text-sm font-medium text-muted-foreground">{t('verification.checks.title')}</p>
              <ul className="space-y-1.5">
                {reasons.map((entry, index) => (
                  <ReasonLine key={`${entry.check}-${entry.result}-${index}`} reason={entry} />
                ))}
              </ul>
              {provisional && <p className="text-xs text-muted-foreground">{t('verification.provisional.explain')}</p>}
            </div>
          )}

          <p className="text-sm text-muted-foreground" data-testid="verification-contact-hint">
            {email ? t('verification.guest.contactHint') : t('verification.guest.noContact')}{' '}
            <Link
              className="inline-flex items-center gap-1 underline underline-offset-2"
              to={`/app/short-rent/bookings/${encodeURIComponent(verification.bookingId)}`}
            >
              {t('verification.guest.openBooking')}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </Link>
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleRequestPhoto}
              disabled={busy}
              loading={requestNewPhoto.isPending}
            >
              {t('verification.action.request_photo')}
            </Button>
            <Button
              variant="default"
              onClick={() => setShowVerifyDialog(true)}
              disabled={busy}
              data-testid="verification-decide"
            >
              {t('verification.action.verify')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectDialog(true)}
              disabled={busy}
              data-testid="verification-reject"
            >
              {t('verification.action.reject')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Decision dialog: approve (the note is optional) or not verified (the note is required) */}
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
                aria-describedby="verify-note-hint"
              />
              <p id="verify-note-hint" className="text-xs text-muted-foreground">
                {t('verification.dialog.noteHint')}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVerifyDialog(false)}
              disabled={busy}
            >
              {t('shared.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleVerify(false)}
              disabled={busy || !note.trim()}
              data-testid="verification-not-verified"
            >
              {t('verification.dialog.rejectButton')}
            </Button>
            <Button
              onClick={() => handleVerify(true)}
              disabled={busy}
              loading={recordVerification.isPending}
              data-testid="verification-approve"
            >
              {t('verification.dialog.acceptButton')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog: the check-in is closed and no further attempt is possible; the reason is required */}
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
                required
                aria-required="true"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={busy}
            >
              {t('shared.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={busy || !reason.trim()}
              loading={rejectVerification.isPending}
              data-testid="verification-confirm-reject"
            >
              {t('verification.dialog.confirmReject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
