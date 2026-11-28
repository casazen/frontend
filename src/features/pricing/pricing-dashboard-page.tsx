import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { SlidersHorizontal } from 'lucide-react';
import { ErrorState } from '@/components/shared/error-state';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import type { PageCrumb } from '@/lib/page-crumbs';
import {
  usePricingAdapterConfig,
  useSavePricingAdapterConfig,
  useDisablePricingAdapter,
  useRecalculateSuggestions,
  useApplySeasonalSuggestions,
  useSeasonalSuggestions,
} from '@/queries/use-pricing-adapter';
import { useProperty } from '@/queries/use-properties';
import type { PricingAdapterConfig, SavePricingAdapterConfigRequest } from '@/types';
import { PricingFocus } from './components/pricing-focus';
import { PricingRulesSection } from './components/pricing-rules-section';
import { PricingSuggestionsSection } from './components/pricing-suggestions-section';

const PROPERTIES_PATH = '/app/short-rent/properties';

function PricingSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-busy="true" className="min-w-0 space-y-6" data-testid="pricing-loading">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-2/3 max-w-sm motion-reduce:animate-none" />
          <Skeleton className="h-4 w-1/2 max-w-xs motion-reduce:animate-none" />
        </div>
        <Skeleton className="h-44 w-full rounded-xl motion-reduce:animate-none" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-full motion-reduce:animate-none" />
          <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
          <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
        </div>
      </div>
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

export function PricingDashboardPage() {
  const { t } = useTranslation();
  const { id: propertyId } = useParams<{ id: string }>();

  const configQuery = usePricingAdapterConfig(propertyId!);
  const suggestionsQuery = useSeasonalSuggestions(propertyId!);
  const property = useProperty(propertyId!);

  const saveConfig = useSavePricingAdapterConfig(propertyId!);
  const disableConfig = useDisablePricingAdapter(propertyId!);
  const recalculate = useRecalculateSuggestions(propertyId!);
  const apply = useApplySeasonalSuggestions(propertyId!);

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
    return <PricingSkeleton label={t('pricing.dashboard.loading')} />;
  }

  const title = t('pricing.dashboard.title');
  const propertyName = property.data?.name;
  const crumbs: PageCrumb[] = [
    { label: t('nav.properties'), to: PROPERTIES_PATH },
    ...(propertyName ? [{ label: propertyName, to: `${PROPERTIES_PATH}/${propertyId}` }] : []),
    { label: title },
  ];

  const suggestions = suggestionsQuery.data;
  const hasSuggestions = Boolean(config?.isEnabled && suggestions && suggestions.currentBasePrice > 0 && suggestions.items.length > 0);

  return (
    <AppShell>
      <div className="min-w-0 space-y-6">
        <PageHeader
          crumbs={crumbs}
          title={title}
          description={propertyName}
          action={
            config && !configQuery.isError ? (
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                  <Switch checked={config.isEnabled} disabled={isSaving} onCheckedChange={handleToggle}
                    aria-label={t('pricing.config.enableLabel')} data-testid="pricing-toggle" />
                  {config.isEnabled ? t('pricing.config.active') : t('pricing.config.disabled')}
                </label>
                <Dialog key={propertyId}>
                  <DialogTrigger asChild>
                    <Button type="button" variant="outline" data-testid="pricing-open-rules">
                      <SlidersHorizontal aria-hidden="true" className="size-4" />
                      {t('pricing.config.rulesLabel')}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" aria-describedby={undefined}>
                    <DialogHeader><DialogTitle>{t('pricing.config.rulesLabel')}</DialogTitle></DialogHeader>
                    <PricingRulesSection config={config} isSaving={isSaving} onSave={handleSave} />
                  </DialogContent>
                </Dialog>
              </div>
            ) : undefined
          }
        />

        {configQuery.isError || !config ? (
          <ErrorState
            testId="config-error"
            title={t('pricing.dashboard.configLoadError')}
            error={configQuery.error}
            onRetry={() => void configQuery.refetch()}
          />
        ) : (
          <div className="min-w-0 space-y-8">
            <PricingFocus
              propertyId={propertyId!}
              config={config}
              suggestions={suggestionsQuery}
              isApplying={apply.isPending}
              isRecalculating={recalculate.isPending}
              onApplyAll={() => apply.mutate([])}
              onRecalculate={() => recalculate.mutate()}
            />
            {hasSuggestions && suggestions ? (
              <PricingSuggestionsSection key={propertyId} data={suggestions} applying={apply.isPending} onApply={(items) => apply.mutate(items)} />
            ) : null}
          </div>
        )}
      </div>
    </AppShell>
  );
}
