import { Download, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useExportImuNotification,
  useImuNotificationStatus,
  useMarkImuNotificationSent,
} from '@/queries/use-canone-concordato';
import { getProblemMessage } from '@/lib/api-errors';
import { formatDate } from '@/lib/utils';
import type { ImuNotificationChannel, ImuNotificationStatus } from '@/api/canone-concordato.api';

interface Props {
  leaseId: string;
}

const REASON_CODES = [
  'imu_notification_not_concordato',
  'imu_notification_lease_not_registered',
  'imu_notification_data_unavailable',
];

/**
 * IMU notification of a canone concordato lease (A7-24, LT-13). The buttons are enabled only when the backend says so
 * (contract type, registered lease, agreement data): never guessed from the status alone. The recipients and the rate
 * come from the reference data on the database.
 */
export function ImuNotificationExportButton({ leaseId }: Props) {
  const { t } = useTranslation();
  const status = useImuNotificationStatus(leaseId);
  const exportImu = useExportImuNotification();
  const markSent = useMarkImuNotificationSent();

  if (status.data && !status.data.applicable) return null;

  const available = status.data?.available === true;

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
    } catch (error) {
      toast.error((await blobProblemMessage(error, t)) ?? t('leases.canoneConcordato.exportError'));
    }
  };

  const handleMarkSent = async () => {
    try {
      await markSent.mutateAsync(leaseId);
      toast.success(t('leases.canoneConcordato.markSentOk'));
    } catch (error) {
      toast.error(getProblemMessage(error, t) ?? t('leases.canoneConcordato.markSentError'));
    }
  };

  return (
    <Card data-testid="imu-notification">
      <CardHeader>
        <CardTitle>{t('leases.canoneConcordato.exportImu')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{t('leases.canoneConcordato.exportImuHint')}</p>

        {status.isLoading && (
          <p className="flex items-center gap-2 text-muted-foreground" data-testid="imu-status-loading">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('leases.canoneConcordato.imuStatusLoading')}
          </p>
        )}

        {status.isError && (
          <div className="space-y-2" role="alert" data-testid="imu-status-error">
            <p className="text-destructive">
              {getProblemMessage(status.error, t) ?? t('leases.canoneConcordato.imuStatusError')}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void status.refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {t('leases.canoneConcordato.retry')}
            </Button>
          </div>
        )}

        {status.data && !available && (
          <p className="rounded-md border p-3" data-testid="imu-unavailable-reason">
            {reasonText(status.data, t)}
          </p>
        )}

        {status.data?.channel && <ChannelDetails channel={status.data.channel} />}

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!available || exportImu.isPending} onClick={() => void handleExport()}>
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
            disabled={!available || markSent.isPending}
            onClick={() => void handleMarkSent()}
          >
            {t('leases.canoneConcordato.markSent')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type TranslateFn = ReturnType<typeof useTranslation>['t'];

function reasonText(status: ImuNotificationStatus, t: TranslateFn): string {
  return status.reasonCode && REASON_CODES.includes(status.reasonCode)
    ? t(`leases.canoneConcordato.imuReason.${status.reasonCode}`)
    : t('leases.canoneConcordato.imuStatusError');
}

/** The export answers a blob: an error body is read back as JSON so its `code` is translated like any other. */
async function blobProblemMessage(error: unknown, t: TranslateFn): Promise<string | undefined> {
  const response = (error as { response?: { data?: unknown } } | null)?.response;
  if (response?.data instanceof Blob) {
    try {
      response.data = JSON.parse(await response.data.text()) as unknown;
    } catch {
      // Not JSON: the generic message below.
    }
  }
  return getProblemMessage(error, t);
}

function ChannelDetails({ channel }: { channel: ImuNotificationChannel }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1 rounded-md bg-muted/40 p-3" data-testid="imu-channel">
      <p className="font-medium">{channel.recipientOffice}</p>
      {channel.email && (
        <p>
          {t('leases.canoneConcordato.imuEmail')}: {channel.email}
        </p>
      )}
      {channel.pec && (
        <p>
          {t('leases.canoneConcordato.imuPec')}: {channel.pec}
        </p>
      )}
      {channel.postalAddress && (
        <p>
          {t('leases.canoneConcordato.imuAddress')}: {channel.postalAddress}
        </p>
      )}
      {channel.instructions && <p className="text-muted-foreground">{channel.instructions}</p>}
      <p data-testid="imu-rate">
        {channel.ratePercent != null && channel.rateYear != null
          ? t(
              channel.rateKind === 'Derived'
                ? 'leases.canoneConcordato.imuRateDerived'
                : 'leases.canoneConcordato.imuRateOfficial',
              { rate: channel.ratePercent, year: channel.rateYear },
            )
          : t('leases.canoneConcordato.imuRateUnknown')}
        {channel.effectiveRatePercent != null && (
          <> · {t('leases.canoneConcordato.imuRateEffective', { rate: channel.effectiveRatePercent })}</>
        )}
      </p>
      {channel.rateNotes && <p className="text-muted-foreground">{channel.rateNotes}</p>}
      <p className="text-muted-foreground">
        {channel.lastVerifiedAt
          ? t('leases.canoneConcordato.imuLastVerified', { date: formatDate(channel.lastVerifiedAt) })
          : t('leases.canoneConcordato.imuNotVerified')}
      </p>
      {(channel.sourceUrl || channel.rateSourceUrl) && (
        <p className="flex flex-wrap gap-3">
          {channel.sourceUrl && (
            <a className="underline" href={channel.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t('leases.canoneConcordato.imuSource')}
            </a>
          )}
          {channel.rateSourceUrl && (
            <a className="underline" href={channel.rateSourceUrl} target="_blank" rel="noopener noreferrer">
              {t('leases.canoneConcordato.imuRateSource')}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
