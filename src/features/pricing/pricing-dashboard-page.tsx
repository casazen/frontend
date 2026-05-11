import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainCircuit, ExternalLink } from 'lucide-react';
import {
  usePricingAdapterConfig,
  useUpdatePricingAdapterConfig,
  useDisablePricingAdapter,
  useTriggerPricingSync,
  usePricingHistory,
  usePricingPreview,
} from '@/queries/pricingAdapter';
import type { CreateOrUpdatePricingAdapterConfigRequest } from '@/types/pricing';
import { PricingConfigCard } from './components/pricing-config-card';
import { PricingHistoryTable } from './components/pricing-history-table';
import { PricingPreviewSection } from './components/pricing-preview-section';

const PAGE_SIZE = 20;

export function PricingDashboardPage() {
  const { id: propertyId } = useParams<{ id: string }>();

  // History filters state
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const historyFilters = {
    page,
    pageSize: PAGE_SIZE,
    ...(from && { from }),
    ...(to && { to }),
  };

  const { data: config, isLoading: isLoadingConfig } = usePricingAdapterConfig(propertyId!);
  const { data: history, isLoading: isLoadingHistory } = usePricingHistory(propertyId!, historyFilters);
  const { data: preview, isLoading: isLoadingPreview } = usePricingPreview(propertyId!);

  const updateConfig = useUpdatePricingAdapterConfig(propertyId!);
  const disableConfig = useDisablePricingAdapter(propertyId!);
  const triggerSync = useTriggerPricingSync(propertyId!);

  const isSaving = updateConfig.isPending || disableConfig.isPending;
  const isSyncing = triggerSync.isPending;

  function handleToggle(enabled: boolean) {
    if (enabled) {
      updateConfig.mutate({
        isEnabled: true,
        adaptationFrequency: config?.adaptationFrequency ?? 'daily',
        includeSeasonality: config?.includeSeasonality ?? true,
        includePublicHolidays: config?.includePublicHolidays ?? true,
      });
    } else {
      disableConfig.mutate();
    }
  }

  function handleSave(data: CreateOrUpdatePricingAdapterConfigRequest) {
    updateConfig.mutate(data);
  }

  function handleFromChange(value: string) {
    setFrom(value);
    setPage(1);
  }

  function handleToChange(value: string) {
    setTo(value);
    setPage(1);
  }

  if (isLoadingConfig) {
    return <LoadingScreen message="Loading pricing configuration..." />;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title="AI Dynamic Pricing"
          description="Manage automated price adaptation and preview AI-suggested rates."
        />

        {/* Configuration + Preview */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <PricingConfigCard
              config={config}
              isSaving={isSaving}
              isSyncing={isSyncing}
              onToggle={handleToggle}
              onSave={handleSave}
              onSync={() => triggerSync.mutate()}
            />
          </div>

          <div className="lg:col-span-2">
            {!config?.isEnabled ? (
              <EmptyState
                icon={BrainCircuit}
                title="AI pricing is disabled"
                description="Enable AI dynamic pricing to see the 90-day price preview and let the engine optimise your nightly rates automatically."
              />
            ) : isLoadingPreview ? (
              <div className="space-y-4">
                <Skeleton className="h-72 w-full rounded-lg" />
                <Skeleton className="h-48 w-full rounded-lg" />
              </div>
            ) : preview && preview.prices.length > 0 ? (
              <PricingPreviewSection prices={preview.prices} />
            ) : (
              <EmptyState
                icon={BrainCircuit}
                title="No preview available"
                description="Run a pricing sync to generate the first 90-day price preview."
              />
            )}
          </div>
        </div>

        {/* Price Adaptation History */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Price Adaptation History</CardTitle>
              <Button variant="outline" size="sm" asChild>
                <Link to={`/properties/${propertyId}/pricing/history`}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Full History
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="history-from">From</Label>
                <Input
                  id="history-from"
                  type="date"
                  value={from}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="w-40"
                  data-testid="history-filter-from"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="history-to">To</Label>
                <Input
                  id="history-to"
                  type="date"
                  value={to}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="w-40"
                  data-testid="history-filter-to"
                />
              </div>
            </div>

            <PricingHistoryTable
              data={history}
              isLoading={isLoadingHistory}
              page={page}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
