import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { gdprApi } from '@/api/gdpr.api';
import { getProblemMessage } from '@/lib/api-errors';
import { formatDate, formatDateTime } from '@/lib/utils';
import { parseStayDate } from '@/lib/stay-dates';
import { Download, Trash2, ShieldOff, Loader2, MailX } from 'lucide-react';
import type { Guest, GuestConsentHistoryItem, GuestRetentionScheduleItem } from '@/types';

interface GdprTabProps {
  guest: Guest;
}

/** Stored on the record: a fixed text, never personal data. */
const ERASURE_REASON = 'User requested erasure';

const WITHDRAWAL_NOTE_MAX_LENGTH = 500;

/**
 * GDPR tab of a guest (CO-15): consents with their versions, retention per category, export, anonymization and
 * erasure. The host can never grant the marketing consent (A5-14): only the guest does, on the check-in portal; the
 * host can only withdraw it on the guest's documented request.
 */
export function GdprTab({ guest }: GdprTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const summaryKey = ['gdpr', 'guests', guest.id] as const;
  const summary = useQuery({ queryKey: summaryKey, queryFn: () => gdprApi.getSummary(guest.id) });

  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawalNote, setWithdrawalNote] = useState('');

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: summaryKey }),
      queryClient.invalidateQueries({ queryKey: ['guests', guest.id] }),
    ]);
  };

  const showError = (error: unknown, fallbackKey: string) => toast.error(getProblemMessage(error, t) ?? t(fallbackKey));

  const exportMutation = useMutation({
    mutationFn: () => gdprApi.exportData(guest.id),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gdpr-export-${guest.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(t('guests.gdprTab.exportSuccess'));
    },
    onError: (error) => showError(error, 'guests.gdprTab.exportError'),
  });

  const anonymizeMutation = useMutation({
    mutationFn: () => gdprApi.anonymizeData(guest.id),
    onSuccess: async () => {
      toast.success(t('guests.gdprTab.anonymizeSuccess'));
      await refresh();
    },
    onError: (error) => showError(error, 'guests.gdprTab.anonymizeError'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => gdprApi.deleteData(guest.id, ERASURE_REASON),
    onSuccess: async () => {
      toast.success(t('guests.gdprTab.deleteSuccess'));
      await refresh();
    },
    onError: (error) => showError(error, 'guests.gdprTab.deleteError'),
  });

  const withdrawMutation = useMutation({
    mutationFn: (note: string) => gdprApi.withdrawMarketingConsent(guest.id, note),
    onSuccess: async () => {
      toast.success(t('guests.gdprTab.withdrawSuccess'));
      setShowWithdraw(false);
      setWithdrawalNote('');
      await refresh();
    },
    onError: (error) => showError(error, 'guests.gdprTab.withdrawError'),
  });

  if (summary.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="gdpr-loading">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('guests.gdprTab.loading')}
      </div>
    );
  }

  if (summary.isError || !summary.data) {
    return (
      <div className="space-y-3" data-testid="gdpr-error" role="alert">
        <p className="text-sm text-destructive">
          {getProblemMessage(summary.error, t) ?? t('guests.gdprTab.loadError')}
        </p>
        <Button variant="outline" size="sm" onClick={() => summary.refetch()}>
          {t('guests.gdprTab.retry')}
        </Button>
      </div>
    );
  }

  const data = summary.data;
  const anonymized = data.anonymizedAt != null;
  const blockedByOpenBookings = data.hasOpenBookings;
  const note = withdrawalNote.trim();

  return (
    <div className="space-y-6">
      {/* Privacy notice and marketing consent */}
      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div data-testid="gdpr-privacy-notice">
          <span className="text-muted-foreground">{t('guests.gdprTab.privacyNotice')}</span>
          <p className="font-medium">
            {data.privacyNotice.version
              ? t('guests.gdprTab.privacyNoticeVersion', {
                  version: data.privacyNotice.version,
                  date: data.privacyNotice.presentedAt ? formatDate(data.privacyNotice.presentedAt) : '—',
                })
              : t('guests.gdprTab.privacyNoticeNone')}
          </p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('guests.gdprTab.processingPurpose')}</span>
          <p className="font-medium">{guest.dataProcessingPurpose || '—'}</p>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3" data-testid="gdpr-marketing">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('guests.gdprTab.marketingTitle')}</p>
            <p className="text-sm" data-testid="gdpr-marketing-state">
              {data.marketing.granted
                ? t(data.marketing.version ? 'guests.gdprTab.marketingGranted' : 'guests.gdprTab.marketingGrantedNoVersion', {
                    date: data.marketing.since ? formatDate(data.marketing.since) : '—',
                    version: data.marketing.version,
                  })
                : t('guests.gdprTab.marketingNotGranted')}
            </p>
            <p className="text-xs text-muted-foreground">{t('guests.gdprTab.marketingOnlyGuest')}</p>
          </div>
          {data.marketing.granted && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWithdraw(true)}
              disabled={withdrawMutation.isPending}
              data-testid="gdpr-marketing-withdraw"
            >
              <MailX className="mr-2 h-4 w-4" />
              {t('guests.gdprTab.withdrawButton')}
            </Button>
          )}
        </div>
      </div>

      <ConsentHistory items={data.consentHistory} />

      <RetentionSchedule items={data.retention} />

      {/* Actions */}
      {blockedByOpenBookings && (
        <p className="text-sm text-amber-700" data-testid="gdpr-open-bookings">
          {t('guests.gdprTab.openBookings')}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          data-testid="gdpr-export-button"
        >
          {exportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {t('guests.export')}
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowAnonymizeConfirm(true)}
          disabled={anonymizeMutation.isPending || anonymized || blockedByOpenBookings}
          data-testid="gdpr-anonymize-button"
        >
          {anonymizeMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldOff className="mr-2 h-4 w-4" />}
          {anonymized ? t('guests.gdprTab.anonymized') : t('guests.anonymize')}
        </Button>

        <Button
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteMutation.isPending || data.isDeleted || blockedByOpenBookings}
          data-testid="gdpr-delete-button"
        >
          {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          {data.isDeleted ? t('guests.gdprTab.deleted') : t('guests.delete')}
        </Button>
      </div>

      {/* Status indicators */}
      <div className="text-sm space-y-1 border-t pt-4">
        {guest.erasureRequested && (
          <p className="text-amber-600">
            {t('guests.gdprTab.erasureRequested')} {guest.erasureRequestedDate ? formatDate(guest.erasureRequestedDate) : '—'}
          </p>
        )}
        {data.alloggiatiDataErasedAt && !anonymized && (
          <p className="text-muted-foreground">
            {t('guests.gdprTab.alloggiatiDataErasedOn', { date: formatDate(data.alloggiatiDataErasedAt) })}
          </p>
        )}
        {data.anonymizedAt && (
          <p className="text-muted-foreground">
            {t('guests.gdprTab.anonymizedOn')} {formatDate(data.anonymizedAt)}
          </p>
        )}
        {data.isDeleted && (
          <p className="text-destructive">
            {t('guests.gdprTab.deletedOn')} {data.deletedAt ? formatDate(data.deletedAt) : '—'}
          </p>
        )}
      </div>

      <ConfirmationDialog
        open={showAnonymizeConfirm}
        onOpenChange={setShowAnonymizeConfirm}
        title={t('guests.gdprTab.anonymizeTitle')}
        description={t('guests.gdprTab.anonymizeDescription')}
        confirmLabel={t('guests.gdprTab.anonymizeConfirm')}
        variant="destructive"
        onConfirm={() => anonymizeMutation.mutate()}
        isLoading={anonymizeMutation.isPending}
      />

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('guests.gdprTab.deleteTitle')}
        description={t('guests.deleteConfirm')}
        confirmLabel={t('guests.gdprTab.deleteConfirmLabel')}
        variant="destructive"
        onConfirm={() => deleteMutation.mutate()}
        isLoading={deleteMutation.isPending}
      />

      <Dialog open={showWithdraw} onOpenChange={setShowWithdraw}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('guests.gdprTab.withdrawTitle')}</DialogTitle>
            <DialogDescription>{t('guests.gdprTab.withdrawDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="gdpr-withdrawal-note">{t('guests.gdprTab.withdrawNoteLabel')}</Label>
            <Textarea
              id="gdpr-withdrawal-note"
              value={withdrawalNote}
              maxLength={WITHDRAWAL_NOTE_MAX_LENGTH}
              onChange={(event) => setWithdrawalNote(event.target.value)}
              placeholder={t('guests.gdprTab.withdrawNotePlaceholder')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWithdraw(false)} disabled={withdrawMutation.isPending}>
              {t('shared.cancel')}
            </Button>
            <Button
              onClick={() => withdrawMutation.mutate(note)}
              disabled={note.length === 0 || withdrawMutation.isPending}
              data-testid="gdpr-marketing-withdraw-confirm"
            >
              {withdrawMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('guests.gdprTab.withdrawConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConsentHistory({ items }: { items: GuestConsentHistoryItem[] }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2" data-testid="gdpr-consent-history">
      <p className="text-sm font-medium">{t('guests.gdprTab.historyTitle')}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('guests.gdprTab.historyEmpty')}</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {[...items].reverse().map((item) => (
            <li key={`${item.recordedAt}-${item.purpose}-${item.action}`}>
              <span className="font-medium">{t(`guests.gdprTab.action.${item.action}`)}</span>
              {' · '}
              {t(`guests.gdprTab.purpose.${item.purpose}`)}
              {' · '}
              {item.version ? t('guests.gdprTab.historyVersion', { version: item.version }) : t('guests.gdprTab.historyNoVersion')}
              {' · '}
              {t(`guests.gdprTab.source.${item.source}`)}
              {' · '}
              {formatDateTime(item.recordedAt)}
              {item.note && <span className="block text-muted-foreground">{item.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RetentionSchedule({ items }: { items: GuestRetentionScheduleItem[] }) {
  const { t } = useTranslation();

  const period = (item: GuestRetentionScheduleItem) =>
    [
      item.years ? t('guests.gdprTab.period.years', { count: item.years }) : null,
      item.months ? t('guests.gdprTab.period.months', { count: item.months }) : null,
      item.days != null && (item.days > 0 || (!item.years && !item.months)) ? t('guests.gdprTab.period.days', { count: item.days }) : null,
    ]
      .filter((part): part is string => part !== null)
      .join(' + ');

  return (
    <div className="space-y-2" data-testid="gdpr-retention">
      <p className="text-sm font-medium">{t('guests.gdprTab.retentionTitle')}</p>
      <ul className="space-y-2 text-sm">
        {items.map((item) => (
          <li key={item.category} data-testid={`gdpr-retention-${item.category}`} className="rounded-md border p-3">
            <p className="font-medium">{t(`guests.gdprTab.category.${item.category}`)}</p>
            {item.configured ? (
              <>
                <p>{t('guests.gdprTab.retentionPeriod', { period: period(item), source: item.source ?? '—' })}</p>
                <p className="text-muted-foreground">
                  {item.dueDate
                    ? t('guests.gdprTab.retentionDue', { date: formatDate(parseStayDate(item.dueDate)) })
                    : t('guests.gdprTab.retentionNoReference')}
                </p>
              </>
            ) : (
              <p className="text-amber-700">{t('guests.gdprTab.retentionNotConfigured')}</p>
            )}
            {item.appliedAt && (
              <p className="text-muted-foreground">{t('guests.gdprTab.retentionApplied', { date: formatDate(item.appliedAt) })}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
