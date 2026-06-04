import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, PenLine } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useInitiateSigning,
  useLease,
  useLeaseRegistration,
  useTriggerRegistration,
} from '@/queries/use-leases';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { LeaseStatusBadge } from './components/lease-status-badge';
import { LeaseSigningPanel } from './components/lease-signing-panel';
import { RegistrationStatusPanel } from './components/registration-status-panel';
import { ExtraEUWarningBanner } from './components/extra-eu-warning-banner';
import { FISCAL_REGIME_LABELS } from './schemas/lease.schema';
import type { SignerInfo } from '@/types';

export function LeaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lease, isLoading } = useLease(id!);
  const { data: registration } = useLeaseRegistration(id!, lease?.status);
  const initiateSigning = useInitiateSigning();
  const triggerRegistration = useTriggerRegistration();
  const [signers, setSigners] = useState<SignerInfo[]>([]);

  if (isLoading) {
    return <LoadingScreen message="Loading lease..." />;
  }

  if (!lease) {
    return (
      <div className="py-12 text-center">
        <h2 className="mb-2 text-2xl font-bold">Lease not found</h2>
        <p className="text-muted-foreground">
          The lease you are looking for does not exist or you do not have access.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => navigate('/app/long-rent/leases')}>
          Back to leases
        </Button>
      </div>
    );
  }

  const parties = lease.parties ?? [];

  const showExtraEuBanner =
    lease.hasExtraEUTenant ||
    parties.some((party) => party.role === 'Tenant' && party.isExtraEU);

  const activeSigners = signers.length > 0 ? signers : [];
  const showSigningPanel =
    activeSigners.length > 0 ||
    lease.status === 'AwaitingSignature' ||
    lease.status === 'PartiallySigned';

  const handleInitiateSigning = async () => {
    const result = await initiateSigning.mutateAsync(lease.id);
    setSigners(result.signers);
  };

  const handleRegister = async () => {
    await triggerRegistration.mutateAsync(lease.id);
  };

  const registrationData = registration ?? lease.registration;

  return (
    <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/long-rent/leases')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <PageHeader
            title={lease.property?.name ?? 'Lease contract'}
            description={`${formatDate(lease.startDate)} — ${formatDate(lease.endDate)}`}
          />
          <div className="ml-auto">
            <LeaseStatusBadge status={lease.status} className="text-sm px-3 py-1" />
          </div>
        </div>

        {showExtraEuBanner && <ExtraEUWarningBanner />}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Contract terms</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Monthly rent</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(lease.monthlyRent)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fiscal regime</p>
                  <p className="font-medium">{FISCAL_REGIME_LABELS[lease.fiscalRegime]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Registration deadline</p>
                  <p className="font-medium">{formatDate(lease.registrationDeadline)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Created</p>
                  <p className="font-medium">{formatDateTime(lease.createdAt)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Parties</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {parties.map((party) => (
                  <div
                    key={party.id}
                    className="flex flex-col gap-1 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {party.firstName} {party.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{party.role}</p>
                    </div>
                    <p className="text-sm">{party.contactEmail}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {lease.status === 'Draft' && (
              <Card>
                <CardHeader>
                  <CardTitle>Signing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Generate the contract PDF and send signing links to all parties.
                  </p>
                  <Button
                    onClick={handleInitiateSigning}
                    disabled={initiateSigning.isPending}
                  >
                    {initiateSigning.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Initiating…
                      </>
                    ) : (
                      <>
                        <PenLine className="mr-2 h-4 w-4" />
                        Initiate signing
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {showSigningPanel && activeSigners.length > 0 && (
              <LeaseSigningPanel signers={activeSigners} />
            )}

            <RegistrationStatusPanel
              leaseId={lease.id}
              leaseStatus={lease.status}
              registration={registrationData}
              canRegister={lease.status === 'Signed'}
              onRegister={handleRegister}
              isRegistering={triggerRegistration.isPending}
            />
          </div>

          <div className="space-y-6">
            {lease.events && lease.events.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {lease.events.map((event, index) => (
                    <div key={`${event.eventType}-${index}`} className="border-l-2 pl-3">
                      <p className="font-medium">{event.eventType}</p>
                      <p className="text-muted-foreground">
                        {formatDateTime(event.occurredAt)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </div>
  );
}
