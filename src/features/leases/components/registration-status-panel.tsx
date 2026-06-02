import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { leasesApi } from '@/api/leases.api';
import { REGISTRATION_STATUS_LABELS } from '../schemas/lease.schema';
import type { LeaseRegistration, LeaseStatus } from '@/types';
import { toast } from 'sonner';

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
  const [isDownloading, setIsDownloading] = useState(false);

  const statusConfig = registration
    ? REGISTRATION_STATUS_LABELS[registration.status] ?? {
        label: registration.status,
        variant: 'secondary' as const,
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
      toast.success('Receipt downloaded');
    } catch {
      toast.error('Receipt is not available yet');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>RLI registration</CardTitle>
            <CardDescription>
              Submit the signed contract to the Agenzia delle Entrate via Openapi.it
            </CardDescription>
          </div>
          {statusConfig && (
            <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {registration ? (
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {registration.registrationCode && (
              <div>
                <p className="text-muted-foreground">Registration code</p>
                <p className="font-medium font-mono">{registration.registrationCode}</p>
              </div>
            )}
            {registration.submittedAt && (
              <div>
                <p className="text-muted-foreground">Submitted</p>
                <p className="font-medium">{formatDateTime(registration.submittedAt)}</p>
              </div>
            )}
            {registration.confirmedAt && (
              <div>
                <p className="text-muted-foreground">Confirmed</p>
                <p className="font-medium">{formatDateTime(registration.confirmedAt)}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No registration has been submitted yet.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          {canRegister && onRegister && (
            <Button onClick={onRegister} disabled={isRegistering}>
              {isRegistering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                'Register with Agenzia delle Entrate'
              )}
            </Button>
          )}

          {leaseStatus === 'Registered' && (
            <Button
              variant="outline"
              onClick={handleDownloadReceipt}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading…
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download receipt
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
