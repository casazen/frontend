import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { PAGE_COLUMNS_WIDE } from '@/components/layout/page-columns';
import { ErrorState } from '@/components/shared/error-state';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { PageCrumb } from '@/lib/page-crumbs';
import { cn } from '@/lib/utils';
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

/** The page while the rules load: the shape of the page, no spinner in the middle of nothing. */
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

/**
 * `/app/short-rent/properties/:id/pricing`: the seasonal suggestions of a property (D4, SR-PRIC). The header says whose prices
 * they are; under it the one highlighted block (the base price and the rule that is on, in words, with the button that moves
 * things on), then the rules and, once there are suggestions, the price of each coming night. Prices and minimum stay for a
 * single date are not here: they need a model of prices by date that does not exist yet.
 */
export function PricingDashboardPage() {
  const { t } = useTranslation();
  const { id: propertyId } = useParams<{ id: string }>();

  const configQuery = usePricingAdapterConfig(propertyId!);
  const suggestionsQuery = useSeasonalSuggestions(propertyId!);
  // The name is a courtesy of the header: the page does not wait for it and does not fail without it.
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
            config ? (
              <Badge variant={config.isEnabled ? 'success' : 'secondary'} className="px-3 py-1 text-sm">
                {config.isEnabled ? t('pricing.config.active') : t('pricing.config.disabled')}
              </Badge>
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
              isSaving={isSaving}
              isApplying={apply.isPending}
              isRecalculating={recalculate.isPending}
              onEnable={() => handleToggle(true)}
              onApplyAll={() => apply.mutate([])}
              onRecalculate={() => recalculate.mutate()}
            />
            {/* The rules on the left, the suggestions they give on the right (under each other on a narrow screen). */}
            <div className={cn(PAGE_COLUMNS_WIDE, 'gap-8')}>
              <PricingRulesSection config={config} isSaving={isSaving} onToggle={handleToggle} onSave={handleSave} />
              {hasSuggestions && suggestions ? (
                <PricingSuggestionsSection data={suggestions} applying={apply.isPending} onApply={(items) => apply.mutate(items)} />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
