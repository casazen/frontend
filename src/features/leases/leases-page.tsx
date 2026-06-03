import { useNavigate } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeases } from '@/queries/use-leases';
import { formatCurrency, formatDate } from '@/lib/utils';
import { LeaseStatusBadge } from './components/lease-status-badge';
import { FISCAL_REGIME_LABELS } from './schemas/lease.schema';
import type { LeaseContract } from '@/types';

function getPropertyLabel(lease: LeaseContract): string {
  return lease.property?.name ?? `Property ${lease.propertyId.slice(0, 8)}`;
}

export function LeasesPage() {
  const navigate = useNavigate();
  const { data: leases, isLoading, isError } = useLeases();

  if (isLoading) {
    return <LoadingScreen message="Loading leases..." />;
  }

  const items = leases ?? [];

  return (
    <div className="space-y-6">
        <PageHeader
          title="Long-term leases"
          description="Manage contract drafts, signing, and RLI registration"
          action={
            <Button onClick={() => navigate('/leases/new')}>
              <Plus className="mr-2 h-4 w-4" />
              Create lease
            </Button>
          }
        />

        {isError && (
          <p className="text-sm text-destructive">
            Failed to load leases. Please try again.
          </p>
        )}

        {items.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No leases yet"
            description="Create your first long-term lease contract draft to start the signing and registration workflow."
            action={{
              label: 'Create lease',
              onClick: () => navigate('/leases/new'),
            }}
          />
        ) : (
          <div className="grid gap-4">
            {items.map((lease) => (
              <Card
                key={lease.id}
                className="cursor-pointer transition-colors hover:bg-muted/40"
                onClick={() => navigate(`/leases/${lease.id}`)}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{getPropertyLabel(lease)}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(lease.startDate)} — {formatDate(lease.endDate)}
                    </p>
                  </div>
                  <LeaseStatusBadge status={lease.status} />
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Rent </span>
                    <span className="font-medium">
                      {formatCurrency(lease.monthlyRent)}/mo
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Regime </span>
                    <span className="font-medium">
                      {FISCAL_REGIME_LABELS[lease.fiscalRegime]}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Parties </span>
                    <span className="font-medium">{lease.parties?.length ?? 0}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
