import { useParams } from 'react-router-dom';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Skeleton } from '@/components/ui/skeleton';
import { BrainCircuit } from 'lucide-react';
import {
  usePricingAdapterConfig,
  useSavePricingAdapterConfig,
  useDisablePricingAdapter,
  useTriggerPricingSync,
  usePricingPreview,
} from '@/queries/use-pricing-adapter';
import { PricingConfigCard } from './components/pricing-config-card';
import { PricingPreviewSection } from './components/pricing-preview-section';

export function PricingDashboardPage() {
  const { id: propertyId } = useParams<{ id: string }>();

  const { data: config, isLoading: isLoadingConfig } = usePricingAdapterConfig(propertyId!);
  const { data: preview, isLoading: isLoadingPreview } = usePricingPreview(propertyId!);
  const saveConfig = useSavePricingAdapterConfig(propertyId!);
  const disableConfig = useDisablePricingAdapter(propertyId!);
  const triggerSync = useTriggerPricingSync(propertyId!);

  const isSaving = saveConfig.isPending || disableConfig.isPending;
  const isSyncing = triggerSync.isPending;

  function handleToggle(enabled: boolean) {
    if (enabled) {
      saveConfig.mutate({
        isEnabled: true,
        adaptationFrequency: config?.adaptationFrequency ?? 'daily',
        includeSeasonality: config?.includeSeasonality ?? true,
        includePublicHolidays: config?.includePublicHolidays ?? true,
      });
    } else {
      disableConfig.mutate();
    }
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

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <PricingConfigCard
              config={config}
              isSaving={isSaving}
              isSyncing={isSyncing}
              onToggle={handleToggle}
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
      </div>
    </AppShell>
  );
}
