import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CalendarRange } from 'lucide-react';
import { getProblemMessage } from '@/lib/api-errors';
import {
  usePricingAdapterConfig,
  useSavePricingAdapterConfig,
  useDisablePricingAdapter,
  useRecalculateSuggestions,
  useSeasonalSuggestions,
} from '@/queries/use-pricing-adapter';
import type { PricingAdapterConfig, SavePricingAdapterConfigRequest } from '@/types';
import { PricingConfigCard } from './components/pricing-config-card';
import { PricingSuggestionsSection } from './components/pricing-suggestions-section';

function LoadError({ message, onRetry, testId }: { message: string; onRetry: () => void; testId: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center" data-testid={testId}>
      <p role="alert" className="text-sm text-destructive">
        {message}
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t('pricing.dashboard.retry')}
      </Button>
    </div>
  );
}

function rulesOf(config: PricingAdapterConfig): SavePricingAdapterConfigRequest {
  return {
    isEnabled: config.isEnabled,
    adaptationFrequency: config.adaptationFrequency,
    includeSeasonality: config.includeSeasonality,
    highSeasonMonths: config.highSeasonMonths,
    highSeasonMultiplier: config.highSeasonMultiplier,
    lowSeasonMonths: config.lowSeasonMonths,
    lowSeasonMultiplier: config.lowSeasonMultiplier,
    includePublicHolidays: config.includePublicHolidays,
    holidayMultiplier: config.holidayMultiplier,
  };
}

/** "Suggerimenti stagionali" (D4): rules on the real nightly rate, read-only proposals. */
export function PricingDashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: propertyId } = useParams<{ id: string }>();

  const configQuery = usePricingAdapterConfig(propertyId!);
  const suggestionsQuery = useSeasonalSuggestions(propertyId!);

  const saveConfig = useSavePricingAdapterConfig(propertyId!);
  const disableConfig = useDisablePricingAdapter(propertyId!);
  const recalculate = useRecalculateSuggestions(propertyId!);

  const config = configQuery.data;
  const isSaving = saveConfig.isPending || disableConfig.isPending;

  function handleToggle(enabled: boolean) {
    if (!config) return;
    if (enabled) {
      saveConfig.mutate({ ...rulesOf(config), isEnabled: true });
    } else {
      disableConfig.mutate();
    }
  }

  function handleSave(data: SavePricingAdapterConfigRequest) {
    saveConfig.mutate(data);
  }

  if (configQuery.isLoading) {
    return <LoadingScreen message={t('pricing.dashboard.loading')} />;
  }

  function suggestionsContent() {
    if (!config?.isEnabled) {
      return (
        <EmptyState
          icon={CalendarRange}
          title={t('pricing.dashboard.disabledTitle')}
          description={t('pricing.dashboard.disabledDescription')}
        />
      );
    }
    if (suggestionsQuery.isLoading) {
      return (
        <div className="space-y-4" data-testid="suggestions-loading">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-72 w-full rounded-lg" />
        </div>
      );
    }
    if (suggestionsQuery.isError || !suggestionsQuery.data) {
      return (
        <LoadError
          testId="suggestions-error"
          message={getProblemMessage(suggestionsQuery.error, t) ?? t('pricing.dashboard.suggestionsLoadError')}
          onRetry={() => void suggestionsQuery.refetch()}
        />
      );
    }
    const data = suggestionsQuery.data;
    if (data.currentBasePrice <= 0) {
      return (
        <EmptyState
          icon={CalendarRange}
          title={t('pricing.dashboard.basePriceMissingTitle')}
          description={t('pricing.dashboard.basePriceMissingDescription')}
          action={{
            label: t('pricing.dashboard.editProperty'),
            onClick: () => navigate(`/app/short-rent/properties/${propertyId}/edit`),
          }}
        />
      );
    }
    if (data.items.length === 0) {
      return (
        <EmptyState
          icon={CalendarRange}
          title={t('pricing.dashboard.noSuggestions')}
          description={t('pricing.dashboard.noSuggestionsDescription')}
          action={{ label: t('pricing.config.recalculateNow'), onClick: () => recalculate.mutate() }}
        />
      );
    }
    return <PricingSuggestionsSection data={data} />;
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('pricing.dashboard.title')} description={t('pricing.dashboard.description')} />

        {configQuery.isError || !config ? (
          <LoadError
            testId="config-error"
            message={getProblemMessage(configQuery.error, t) ?? t('pricing.dashboard.configLoadError')}
            onRetry={() => void configQuery.refetch()}
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <PricingConfigCard
                config={config}
                isSaving={isSaving}
                isRecalculating={recalculate.isPending}
                onToggle={handleToggle}
                onSave={handleSave}
                onRecalculate={() => recalculate.mutate()}
              />
            </div>
            <div className="lg:col-span-2">{suggestionsContent()}</div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
