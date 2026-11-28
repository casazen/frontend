import { useState } from 'react';
import { isAxiosError } from 'axios';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import { AiContentNotice } from '@/components/shared/ai-content-notice';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { HelpTip } from '@/components/ui/help-tip';
import { Segmented } from '@/components/ui/segmented';
import { getProblemMessage } from '@/lib/api-errors';
import { usePriceSuggestionAvailability, useSuggestPrice } from '@/queries/use-price-suggestion';
import type { PricePositioning, PriceSuggestion, PriceSuggestionReason } from '@/types';
import type { PropertyWizardValues } from '../property-wizard-model';

interface AiPriceCardProps {
  form: UseFormReturn<PropertyWizardValues>;
  propertyId: string;
  currency?: string;
}

type PriceFields = Pick<PropertyWizardValues, 'nightlyRate' | 'cleaningFee' | 'weekendSurcharge' | 'minNights'>;

type Phase =
  | { kind: 'ask' }
  | { kind: 'declined' }
  | { kind: 'result'; suggestion: PriceSuggestion }
  | { kind: 'applied'; suggestion: PriceSuggestion; previous: PriceFields; applied: Partial<PriceFields> };

const POSITIONINGS: readonly PricePositioning[] = ['Lower', 'Market', 'Higher'];

const RETRYABLE_REASONS: readonly PriceSuggestionReason[] = ['ai_unavailable', 'ai_invalid_answer'];

const SET_OPTIONS = { shouldDirty: true, shouldValidate: true } as const;

function money(value: number, language: string, currency: string): string {
  return new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
}

function writeFields(form: UseFormReturn<PropertyWizardValues>, fields: Partial<PriceFields>) {
  if (fields.nightlyRate !== undefined) form.setValue('nightlyRate', fields.nightlyRate, SET_OPTIONS);
  if (fields.cleaningFee !== undefined) form.setValue('cleaningFee', fields.cleaningFee, SET_OPTIONS);
  if (fields.weekendSurcharge !== undefined) form.setValue('weekendSurcharge', fields.weekendSurcharge, SET_OPTIONS);
  if (fields.minNights !== undefined) form.setValue('minNights', fields.minNights, SET_OPTIONS);
}

function fieldsToRestore(current: PriceFields, applied: Partial<PriceFields>, previous: PriceFields): Partial<PriceFields> {
  const restore: Partial<PriceFields> = {};
  if (applied.nightlyRate !== undefined && current.nightlyRate === applied.nightlyRate) restore.nightlyRate = previous.nightlyRate;
  if (applied.cleaningFee !== undefined && current.cleaningFee === applied.cleaningFee) restore.cleaningFee = previous.cleaningFee;
  if (applied.weekendSurcharge !== undefined && current.weekendSurcharge === applied.weekendSurcharge) {
    restore.weekendSurcharge = previous.weekendSurcharge;
  }
  if (applied.minNights !== undefined && current.minNights === applied.minNights) restore.minNights = previous.minNights;
  return restore;
}

export function AiPriceCard({ form, propertyId, currency = 'EUR' }: AiPriceCardProps) {
  const { t, i18n } = useTranslation();
  const availability = usePriceSuggestionAvailability(propertyId);
  const suggest = useSuggestPrice(propertyId);
  const [phase, setPhase] = useState<Phase>({ kind: 'ask' });
  const [positioning, setPositioning] = useState<PricePositioning>('Market');

  if (availability.data?.available !== true) return null;

  const calculate = () => {
    if (suggest.isPending) return;
    suggest.mutate(positioning, { onSuccess: (suggestion) => setPhase({ kind: 'result', suggestion }) });
  };

  const decline = () => {
    suggest.reset();
    setPhase({ kind: 'declined' });
  };

  const apply = (suggestion: PriceSuggestion) => {
    if (suggestion.nightlyRate === null || (suggestion.currency ?? 'EUR') !== currency) return;
    const current = form.getValues();
    const previous: PriceFields = {
      nightlyRate: current.nightlyRate,
      cleaningFee: current.cleaningFee,
      weekendSurcharge: current.weekendSurcharge,
      minNights: current.minNights,
    };
    const applied: Partial<PriceFields> = { nightlyRate: String(suggestion.nightlyRate) };
    if (suggestion.cleaningFee !== null) applied.cleaningFee = String(suggestion.cleaningFee);
    if (suggestion.weekendSurchargePercent !== null) applied.weekendSurcharge = String(suggestion.weekendSurchargePercent);
    if (suggestion.minNights !== null) applied.minNights = suggestion.minNights;

    writeFields(form, applied);
    setPhase({ kind: 'applied', suggestion, previous, applied });
  };

  const undo = (state: Extract<Phase, { kind: 'applied' }>) => {
    // A field the host changed since is theirs now: it is left alone.
    writeFields(form, fieldsToRestore(form.getValues(), state.applied, state.previous));
    setPhase({ kind: 'result', suggestion: state.suggestion });
  };

  if (phase.kind === 'declined') {
    return (
      <p className="flex flex-wrap items-center gap-x-2 text-sm text-foreground/70" data-testid="property-wizard-ai-price-declined">
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        {t('propertyWizard.prices.ai.declined.text')}
        <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={() => setPhase({ kind: 'ask' })}>
          {t('propertyWizard.prices.ai.declined.again')}
        </Button>
      </p>
    );
  }

  const values = form.getValues();
  const tip = !values.areaSqm.trim() ? 'area' : values.amenities.length === 0 ? 'amenities' : null;

  return (
    <section
      aria-labelledby="property-wizard-ai-price-title"
      className="min-w-0 space-y-3 rounded-lg bg-muted p-4"
      data-testid="property-wizard-ai-price"
    >
      <div className="flex min-w-0 items-start gap-3">
        <Sparkles aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-foreground/70" />
        <div className="min-w-0 flex-1 space-y-1">
          <h3 id="property-wizard-ai-price-title" className="text-base font-semibold">
            {phase.kind === 'ask' ? t('propertyWizard.prices.ai.ask.title') : t('propertyWizard.prices.ai.result.title')}{' '}
            <HelpTip title={t('propertyWizard.prices.ai.help.title')} label={t('propertyWizard.prices.ai.help.label')}>
              {t('propertyWizard.prices.ai.help.body')}
            </HelpTip>
          </h3>
          {phase.kind === 'ask' ? <p className="text-sm text-foreground/70">{t('propertyWizard.prices.ai.ask.description')}</p> : null}
        </div>
      </div>

      <div aria-live="polite" aria-busy={suggest.isPending} className="min-w-0 space-y-3">
        {suggest.isError ? (
          <Alert variant="danger" action={<RetryButton onClick={calculate} disabled={suggest.isPending} />} data-testid="property-wizard-ai-price-error">
            {isAxiosError(suggest.error) && ['ECONNABORTED', 'ETIMEDOUT'].includes(suggest.error.code ?? '')
              ? t('priceEstimate.timeout')
              : getProblemMessage(suggest.error, t) ?? t('propertyWizard.prices.ai.error')}
          </Alert>
        ) : null}
        {phase.kind === 'ask' ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium" id="property-wizard-ai-price-positioning">
                {t('propertyWizard.prices.ai.positioning.question')}
              </p>
              <Segmented
                label={t('propertyWizard.prices.ai.positioning.question')}
                options={POSITIONINGS.map((value) => ({
                  value,
                  label: t(`propertyWizard.prices.ai.positioning.${value}`),
                  testId: `property-wizard-ai-price-positioning-${value}`,
                  disabled: suggest.isPending,
                }))}
                value={positioning}
                onValueChange={setPositioning}
              />
            </div>

            {tip ? (
              <p className="text-sm text-foreground/70" data-testid="property-wizard-ai-price-tip">
                {t(`propertyWizard.prices.ai.tips.${tip}`)}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={calculate} loading={suggest.isPending} data-testid="property-wizard-ai-price-yes">
                {suggest.isPending ? t('propertyWizard.prices.ai.loading') : t('propertyWizard.prices.ai.ask.calculate')}
              </Button>
              <Button type="button" variant="ghost" onClick={decline} disabled={suggest.isPending} data-testid="property-wizard-ai-price-no">
                {t('propertyWizard.prices.ai.ask.decline')}
              </Button>
            </div>
          </>
        ) : (
          <SuggestionView
            suggestion={phase.suggestion}
            form={form}
            language={i18n.language}
            expectedCurrency={currency}
            applied={phase.kind === 'applied'}
            onApply={() => apply(phase.suggestion)}
            onUndo={() => phase.kind === 'applied' && undo(phase)}
            onChangePositioning={() => setPhase({ kind: 'ask' })}
            onRetry={calculate}
            onKeepMine={decline}
            retrying={suggest.isPending}
          />
        )}
      </div>
    </section>
  );
}

function RetryButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <Button type="button" size="sm" variant="outline" onClick={onClick} disabled={disabled}>
      {t('propertyWizard.prices.ai.none.retry')}
    </Button>
  );
}

interface SuggestionViewProps {
  suggestion: PriceSuggestion;
  form: UseFormReturn<PropertyWizardValues>;
  language: string;
  expectedCurrency: string;
  applied: boolean;
  retrying: boolean;
  onApply: () => void;
  onUndo: () => void;
  onChangePositioning: () => void;
  onRetry: () => void;
  onKeepMine: () => void;
}

function SuggestionView({ suggestion, form, language, expectedCurrency, applied, retrying, onApply, onUndo, onChangePositioning, onRetry, onKeepMine }: SuggestionViewProps) {
  const { t } = useTranslation();

  if (suggestion.nightlyRate === null) {
    const reason = suggestion.reason ?? 'ai_unavailable';
    return (
      <div className="space-y-3" data-testid="property-wizard-ai-price-none" data-reason={reason}>
        <Alert variant="info" action={RETRYABLE_REASONS.includes(reason) ? <RetryButton onClick={onRetry} disabled={retrying} /> : undefined}>
          {t(`propertyWizard.prices.ai.none.${reason}`)}
        </Alert>
        <Button type="button" variant="ghost" onClick={onKeepMine} data-testid="property-wizard-ai-price-keep">
          {t('propertyWizard.prices.ai.result.keepMine')}
        </Button>
      </div>
    );
  }

  const { basedOn } = suggestion;
  const currency = suggestion.currency ?? 'EUR';
  const wrongCurrency = currency !== expectedCurrency;
  const extras: string[] = [];
  if (suggestion.cleaningFee !== null) {
    extras.push(t('propertyWizard.prices.ai.result.cleaning', { price: money(suggestion.cleaningFee, language, currency) }));
  }
  if (suggestion.weekendSurchargePercent !== null) {
    extras.push(t('propertyWizard.prices.ai.result.weekend', { percent: suggestion.weekendSurchargePercent }));
  }
  if (suggestion.minNights !== null) {
    extras.push(t('propertyWizard.prices.ai.result.minNights', { count: suggestion.minNights }));
  }

  return (
    <div className="space-y-3" data-testid="property-wizard-ai-price-result">
      <div className="space-y-1">
        <p className="text-2xl font-semibold" data-testid="property-wizard-ai-price-rate">
          {t('propertyWizard.prices.ai.result.perNight', { price: money(suggestion.nightlyRate, language, currency) })}
        </p>
        {suggestion.rangeMin !== null && suggestion.rangeMax !== null ? (
          <p className="text-sm text-foreground/70" data-testid="property-wizard-ai-price-range">
            {t('propertyWizard.prices.ai.result.range', {
              min: money(suggestion.rangeMin, language, currency),
              max: money(suggestion.rangeMax, language, currency),
            })}
          </p>
        ) : null}
        {extras.length > 0 ? (
          <p className="text-sm" data-testid="property-wizard-ai-price-extras">
            {t('propertyWizard.prices.ai.result.also', { items: extras.join(', ') })}
          </p>
        ) : null}
      </div>

      {suggestion.aiUsed && suggestion.rationale ? (
        <p className="text-sm" data-testid="property-wizard-ai-price-why">
          <span className="font-medium">{t('propertyWizard.prices.ai.result.why')}: </span>
          {suggestion.rationale}
        </p>
      ) : null}

      {!suggestion.aiUsed ? (
        <p className="text-sm text-foreground/70" data-testid="property-wizard-ai-price-figures-only">
          {t('propertyWizard.prices.ai.result.figuresOnly', { count: basedOn.similarListings, comune: basedOn.comune ?? '' })}
        </p>
      ) : null}

      <p className="text-xs text-foreground/70" data-testid="property-wizard-ai-price-based-on">
        {t('propertyWizard.prices.ai.basedOn.label')} {basedOnParts(suggestion, form, t).join(' · ')}
      </p>
      <p className="text-xs text-foreground/70">{t('propertyWizard.prices.ai.result.estimate')}</p>
      <AiContentNotice visible={suggestion.aiUsed} />
      {wrongCurrency ? <Alert variant="warning">{t('priceEstimate.currencyMismatch', { currency: expectedCurrency })}</Alert> : null}

      {applied ? (
        <div className="space-y-2" data-testid="property-wizard-ai-price-applied">
          <Alert variant="success">{t('propertyWizard.prices.ai.applied.text')}</Alert>
          <Button type="button" variant="outline" size="sm" onClick={onUndo} data-testid="property-wizard-ai-price-undo">
            {t('propertyWizard.prices.ai.applied.undo')}
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={onApply} disabled={wrongCurrency || retrying} data-testid="property-wizard-ai-price-apply">
            {t('propertyWizard.prices.ai.result.apply')}
          </Button>
          <Button type="button" variant="outline" onClick={onChangePositioning} disabled={retrying} data-testid="property-wizard-ai-price-again">
            {t('propertyWizard.prices.ai.result.again')}
          </Button>
          <Button type="button" variant="ghost" onClick={onKeepMine} data-testid="property-wizard-ai-price-keep">
            {t('propertyWizard.prices.ai.result.keepMine')}
          </Button>
        </div>
      )}
    </div>
  );
}

function basedOnParts(suggestion: PriceSuggestion, form: UseFormReturn<PropertyWizardValues>, t: (key: string, options?: Record<string, unknown>) => string): string[] {
  const { basedOn } = suggestion;
  const used = new Set(basedOn.usedFields);
  const values = form.getValues();
  const parts: string[] = [];

  if (basedOn.comune) parts.push(basedOn.comune);
  if (used.has('guests') && values.maxGuests > 0) parts.push(t('propertyWizard.prices.ai.basedOn.guests', { count: values.maxGuests }));
  if (used.has('bedrooms') && values.bedrooms > 0) parts.push(t('propertyWizard.prices.ai.basedOn.bedrooms', { count: values.bedrooms }));
  if (used.has('area') && values.areaSqm.trim()) parts.push(t('propertyWizard.prices.ai.basedOn.area', { area: values.areaSqm.trim() }));
  if (used.has('amenities') && basedOn.amenities > 0) parts.push(t('propertyWizard.prices.ai.basedOn.amenities', { count: basedOn.amenities }));
  parts.push(
    basedOn.similarListings > 0
      ? t('propertyWizard.prices.ai.basedOn.similar', { count: basedOn.similarListings })
      : t('propertyWizard.prices.ai.basedOn.general'),
  );
  return parts;
}
