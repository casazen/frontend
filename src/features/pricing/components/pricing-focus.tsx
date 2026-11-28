import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import type { PricingAdapterConfig, SeasonalSuggestionsResponse } from '@/types';
import { Button } from '@/components/ui/button';

interface SuggestionsState {
  data: SeasonalSuggestionsResponse | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

interface PricingFocusProps {
  propertyId: string;
  config: PricingAdapterConfig;
  suggestions: SuggestionsState;
  isApplying: boolean;
  isRecalculating: boolean;
  onApplyAll: () => void;
  onRecalculate: () => void;
}

export function PricingFocus({
  propertyId,
  config,
  suggestions,
  isApplying,
  isRecalculating,
  onApplyAll,
  onRecalculate,
}: PricingFocusProps) {
  const { t } = useTranslation();
  const data = suggestions.data;
  const basePrice = data?.currentBasePrice ?? 0;

  const recalculate: CalmAction = {
    label: isRecalculating ? t('pricing.config.recalculating') : t('pricing.config.recalculateNow'),
    onClick: onRecalculate,
    loading: isRecalculating,
    testId: 'recalculate-btn',
  };
  const applyAll: CalmAction = {
    label: t('pricing.suggestions.applyAll'),
    onClick: onApplyAll,
    loading: isApplying,
    testId: 'apply-all-suggestions',
  };

  if (!config.isEnabled) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground" data-testid="pricing-focus" data-state="off">
        <p>{t('pricing.dashboard.disabledDescription')}</p>
        {basePrice > 0 && <p>{t('pricing.focus.offPrice', { price: formatCurrency(basePrice) })}</p>}
      </div>
    );
  }

  if (suggestions.isLoading) {
    return (
      <div role="status" aria-busy="true" data-testid="suggestions-loading">
        <span className="sr-only">{t('pricing.dashboard.loading')}</span>
        <Skeleton aria-hidden="true" className="h-44 w-full rounded-xl motion-reduce:animate-none" />
      </div>
    );
  }

  if (suggestions.isError || !data) {
    return (
      <ErrorState
        testId="suggestions-error"
        title={t('pricing.dashboard.suggestionsLoadError')}
        error={suggestions.error}
        onRetry={() => void suggestions.refetch()}
      />
    );
  }

  if (basePrice <= 0) {
    return (
      <FocusBlock
        data-testid="pricing-focus"
        data-state="no-price"
        tone="warning"
        kicker={t('pricing.focus.kicker')}
        title={t('pricing.dashboard.basePriceMissingTitle')}
        body={t('pricing.dashboard.basePriceMissingDescription')}
        primary={{ label: t('pricing.dashboard.editProperty'), href: `/app/short-rent/properties/${propertyId}/edit` }}
      />
    );
  }

  if (data.items.length === 0) {
    return (
      <FocusBlock
        data-testid="pricing-focus"
        data-state="empty"
        kicker={t('pricing.focus.kicker')}
        title={t('pricing.dashboard.noSuggestions')}
        body={t('pricing.dashboard.noSuggestionsDescription')}
        primary={recalculate}
      />
    );
  }

  const computedBase = data.items[0]?.basePrice;
  if (computedBase !== undefined && computedBase !== basePrice) {
    return (
      <FocusBlock
        data-testid="pricing-focus"
        data-state="stale"
        tone="warning"
        kicker={t('pricing.focus.kicker')}
        title={t('pricing.focus.baseChangedTitle')}
        body={
          <span data-testid="base-changed-warning">
            {t('pricing.suggestions.baseChanged', { computed: formatCurrency(computedBase), current: formatCurrency(basePrice) })}
          </span>
        }
        primary={recalculate}
        secondary={applyAll}
      />
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid="current-base-price" data-state="ready">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">{t('pricing.focus.kicker')}</p>
        <p className="text-xl font-semibold tabular-nums">{t('pricing.focus.price', { price: formatCurrency(basePrice) })}</p>
        <p className="text-sm text-muted-foreground" data-testid="apply-notice">{t('pricing.suggestions.applyNotice')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={onApplyAll} loading={isApplying} data-testid={applyAll.testId}>{applyAll.label}</Button>
        <Button variant="outline" onClick={onRecalculate} loading={isRecalculating} data-testid={recalculate.testId}>{recalculate.label}</Button>
      </div>
    </div>
  );
}
