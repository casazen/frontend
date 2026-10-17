import { useTranslation } from 'react-i18next';
import { FocusBlock, type CalmAction } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/utils';
import type { PricingAdapterConfig, SeasonalSuggestionsResponse } from '@/types';
import { ruleSentences } from '../seasonal-rules';

/** What the query of the suggestions says, as the block needs it (a `useQuery` result fits). */
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
  /** The rules are being saved or the suggestions turned on or off. */
  isSaving: boolean;
  isApplying: boolean;
  isRecalculating: boolean;
  onEnable: () => void;
  onApplyAll: () => void;
  onRecalculate: () => void;
}

/**
 * The one highlighted block of the page: the base price and the rule that is on, in plain words, with the one button that
 * moves things on. What the button is depends on where the suggestions stand: off (turn them on), no price (set it), nothing
 * computed yet (compute), the price changed since they were computed (compute again) or ready (apply them).
 */
export function PricingFocus({
  propertyId,
  config,
  suggestions,
  isSaving,
  isApplying,
  isRecalculating,
  onEnable,
  onApplyAll,
  onRecalculate,
}: PricingFocusProps) {
  const { t, i18n } = useTranslation();
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
      <FocusBlock
        data-testid="pricing-focus"
        data-state="off"
        kicker={t('pricing.focus.kicker')}
        title={t('pricing.dashboard.disabledTitle')}
        body={
          <>
            <p>{t('pricing.dashboard.disabledDescription')}</p>
            {basePrice > 0 ? <p className="mt-2">{t('pricing.focus.offPrice', { price: formatCurrency(basePrice) })}</p> : null}
          </>
        }
        primary={{ label: t('pricing.focus.enable'), onClick: onEnable, loading: isSaving, testId: 'pricing-enable' }}
      />
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

  // The price changed after the last computation: the suggestions come from the old one.
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

  const rules = ruleSentences(config, t, i18n.language);
  return (
    <FocusBlock
      data-testid="current-base-price"
      data-state="ready"
      kicker={t('pricing.focus.kicker')}
      title={t('pricing.focus.price', { price: formatCurrency(basePrice) })}
      body={
        <>
          {rules.length > 0 ? rules.map((sentence) => <p key={sentence}>{sentence}</p>) : <p>{t('pricing.focus.noRules')}</p>}
          <p className="mt-2" data-testid="apply-notice">
            {t('pricing.suggestions.applyNotice')}
          </p>
        </>
      }
      primary={applyAll}
      secondary={recalculate}
    />
  );
}
