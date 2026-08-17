import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { leasesApi } from '@/api/leases.api';
import { REGISTRATION_STATUS_VARIANTS } from '../schemas/lease.schema';
import { getRegistrationStatusLabel } from '@/lib/i18n-labels';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { LeaseRegistration, LeaseStatus } from '@/types';

interface RegistrationStatusPanelProps {
  leaseId: string;
  leaseStatus: LeaseStatus;
  registration?: LeaseRegistration | null;
  onRegister?: () => void;
  isRegistering?: boolean;
  canRegister?: boolean;
}

export function RegistrationStatusPanel({
  leaseId,
  leaseStatus,
  registration,
  onRegister,
  isRegistering,
  canRegister,
}: RegistrationStatusPanelProps) {
  const { t } = useTranslation();
  const [isDownloading, setIsDownloading] = useState(false);

  const statusConfig = registration
    ? {
        label: getRegistrationStatusLabel(registration.status, t),
        variant: (REGISTRATION_STATUS_VARIANTS[registration.status] ?? 'secondary') as
          | 'default'
          | 'secondary'
          | 'outline'
          | 'destructive'
          | 'success',
      }
    : null;

  const handleDownloadReceipt = async () => {
    setIsDownloading(true);
    try {
      const blob = await leasesApi.downloadReceipt(leaseId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `receipt-${leaseId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t('leases.rli.receiptOk'));
    } catch {
      toast.error(t('leases.rli.receiptError'));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{t('leases.rli.registrationTitle')}</CardTitle>
            <CardDescription>{t('leases.rli.registrationDescription')}</CardDescription>
          </div>
          {statusConfig && <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {registration ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {registration.registrationCode && (
              <div>
                <p className="text-muted-foreground">{t('leases.rli.registrationCode')}</p>
                <p className="font-medium font-mono">{registration.registrationCode}</p>
              </div>
            )}
            {registration.submittedAt && (
              <div>
                <p className="text-muted-foreground">{t('leases.rli.submitted')}</p>
                <p className="font-medium">{formatDateTime(registration.submittedAt)}</p>
              </div>
            )}
            {registration.confirmedAt && (
              <div>
                <p className="text-muted-foreground">{t('leases.rli.confirmed')}</p>
                <p className="font-medium">{formatDateTime(registration.confirmedAt)}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('leases.rli.notSubmitted')}</p>
        )}

        <div className="flex flex-wrap gap-3">
          {canRegister && onRegister && (
            <Button onClick={onRegister} disabled={isRegistering}>
              {isRegistering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('leases.rli.submitting')}
                </>
              ) : (
                t('leases.rli.submit')
              )}
            </Button>
          )}

          {leaseStatus === 'Registered' && (
            <Button variant="outline" onClick={handleDownloadReceipt} disabled={isDownloading}>
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('leases.rli.downloading')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('leases.rli.downloadReceipt')}
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
