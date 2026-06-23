import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { gdprApi } from '@/api/gdpr.api';
import { formatDate } from '@/lib/utils';
import { Download, Trash2, ShieldOff, Loader2 } from 'lucide-react';
import type { Guest } from '@/types';

interface GdprTabProps {
  guest: Guest;
}

export function GdprTab({ guest }: GdprTabProps) {
  const { t } = useTranslation();

  // Confirmation dialogs state
  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteReason = 'User requested erasure';

  // Export mutation
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
    onError: () => {
      toast.error(t('guests.gdprTab.exportError'));
    },
  });

  // Anonymize mutation
  const anonymizeMutation = useMutation({
    mutationFn: () => gdprApi.anonymizeData(guest.id),
    onSuccess: () => {
      toast.success(t('guests.gdprTab.anonymizeSuccess'));
    },
    onError: () => {
      toast.error(t('guests.gdprTab.anonymizeError'));
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: () => gdprApi.deleteData(guest.id, deleteReason || 'User requested erasure'),
    onSuccess: () => {
      toast.success(t('guests.gdprTab.deleteSuccess'));
    },
    onError: () => {
      toast.error(t('guests.gdprTab.deleteError'));
    },
  });

  // Consent mutation
  const consentMutation = useMutation({
    mutationFn: (marketingConsent: boolean) =>
      gdprApi.updateConsent(guest.id, marketingConsent),
    onSuccess: () => {
      toast.success(t('guests.gdprTab.consentSuccess'));
    },
    onError: () => {
      toast.error(t('guests.gdprTab.consentError'));
    },
  });

  const formatOptionalDate = (d?: Date | string): string => {
    if (!d) return '—';
    return formatDate(d);
  };

  return (
    <div className="space-y-6">
      {/* Data Retention Info */}
      <div className="grid gap-4 md:grid-cols-2 text-sm">
        <div>
          <span className="text-muted-foreground">{t('guests.retention')}</span>
          <p className="font-medium">{formatOptionalDate(guest.dataRetentionUntil)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('guests.gdprTab.dataConsent')}</span>
          <p className="font-medium">{formatOptionalDate(guest.consentDate)}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('guests.gdprTab.processingPurpose')}</span>
          <p className="font-medium">{guest.dataProcessingPurpose || '—'}</p>
        </div>
        <div>
          <span className="text-muted-foreground">{t('guests.consentMarketing')}</span>
          <p className="font-medium">
            {guest.marketingConsentDate ? formatOptionalDate(guest.marketingConsentDate) : '—'}
          </p>
        </div>
      </div>

      {/* Marketing Consent Toggle */}
      <div className="flex items-center justify-between rounded-lg border p-4">
        <div className="space-y-0.5">
          <Label htmlFor="marketing-consent">{t('guests.consentMarketing')}</Label>
          <p className="text-sm text-muted-foreground">
            {t('guests.gdprTab.marketingConsentDescription')}
          </p>
        </div>
        <Switch
          id="marketing-consent"
          checked={guest.marketingConsent}
          onCheckedChange={(checked) => consentMutation.mutate(checked)}
          disabled={consentMutation.isPending}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
        >
          {exportMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          {t('guests.export')}
        </Button>

        <Button
          variant="outline"
          onClick={() => setShowAnonymizeConfirm(true)}
          disabled={anonymizeMutation.isPending || guest.dataAnonymizedDate != null}
        >
          {anonymizeMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ShieldOff className="mr-2 h-4 w-4" />
          )}
          {guest.dataAnonymizedDate ? t('guests.gdprTab.anonymized') : t('guests.anonymize')}
        </Button>

        <Button
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteMutation.isPending || guest.isDeleted}
        >
          {deleteMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          {guest.isDeleted ? t('guests.gdprTab.deleted') : t('guests.delete')}
        </Button>
      </div>

      {/* Status indicators */}
      <div className="text-sm space-y-1 border-t pt-4">
        {guest.erasureRequested && (
          <p className="text-amber-600">
            {t('guests.gdprTab.erasureRequested')} {formatOptionalDate(guest.erasureRequestedDate)}
          </p>
        )}
        {guest.dataAnonymizedDate && (
          <p className="text-muted-foreground">
            {t('guests.gdprTab.anonymizedOn')} {formatOptionalDate(guest.dataAnonymizedDate)}
          </p>
        )}
        {guest.isDeleted && (
          <p className="text-destructive">
            {t('guests.gdprTab.deletedOn')} {formatOptionalDate(guest.deletedAt)}
            {guest.deletionReason && ` — ${guest.deletionReason}`}
          </p>
        )}
      </div>

      {/* Anonymize Confirmation */}
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

      {/* Delete Confirmation */}
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
    </div>
  );
}
