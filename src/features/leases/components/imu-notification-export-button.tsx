import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useExportImuNotification,
  useMarkImuNotificationSent,
} from '@/queries/use-canone-concordato';
import type { LeaseStatus } from '@/types';

interface Props {
  leaseId: string;
  leaseStatus: LeaseStatus;
}

export function ImuNotificationExportButton({ leaseId, leaseStatus }: Props) {
  const { t } = useTranslation();
  const exportImu = useExportImuNotification();
  const markSent = useMarkImuNotificationSent();
  const enabled = leaseStatus === 'Registered';

  const handleExport = async () => {
    try {
      const blob = await exportImu.mutateAsync(leaseId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `comunicazione-imu-${leaseId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t('leases.canoneConcordato.exportOk'));
    } catch {
      toast.error(t('leases.canoneConcordato.exportError'));
    }
  };

  const handleMarkSent = async () => {
    try {
      await markSent.mutateAsync(leaseId);
      toast.success(t('leases.canoneConcordato.markSentOk'));
    } catch {
      toast.error(t('leases.canoneConcordato.markSentError'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.canoneConcordato.exportImu')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('leases.canoneConcordato.exportImuHint')}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!enabled || exportImu.isPending} onClick={handleExport}>
            {exportImu.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('leases.canoneConcordato.exporting')}
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                {t('leases.canoneConcordato.exportImu')}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!enabled || markSent.isPending}
            onClick={handleMarkSent}
          >
            {t('leases.canoneConcordato.markSent')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
