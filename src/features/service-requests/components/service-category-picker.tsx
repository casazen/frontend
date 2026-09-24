import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useServiceCategories } from '@/queries/use-service-categories';
import { getServiceCategoryLabel } from '@/lib/i18n-labels';
import { unknownCategories } from '@/lib/service-categories';

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function CatalogLoading() {
  const { t } = useTranslation();
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="service-categories-loading">
      <Loader2 className="h-4 w-4 animate-spin" />
      {t('serviceCategories.loading')}
    </p>
  );
}

function CatalogError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert" data-testid="service-categories-error">
      <span>{t('serviceCategories.loadError')}</span>
      <Button type="button" size="sm" variant="outline" onClick={onRetry}>
        {t('serviceCategories.retry')}
      </Button>
    </div>
  );
}

interface ServiceCategoryPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/**
 * Multiple choice of service categories (supplier profile, activation, admin invite). The options are
 * the backend catalog (SU-03); stored values that are not in it are listed in a warning, because they
 * are dropped when the form is saved.
 */
export function ServiceCategoryPicker({ value, onChange, disabled }: ServiceCategoryPickerProps) {
  const { t } = useTranslation();
  const { data: codes, isLoading, isError, refetch } = useServiceCategories();

  if (isLoading) return <CatalogLoading />;
  if (isError || !codes) return <CatalogError onRetry={() => void refetch()} />;
  if (codes.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('serviceCategories.empty')}</p>;
  }

  const unknown = unknownCategories(value, codes);
  const toggle = (code: string) =>
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2" data-testid="service-category-picker">
        {codes.map((code) => (
          <Button
            key={code}
            type="button"
            size="sm"
            variant={value.includes(code) ? 'default' : 'outline'}
            aria-pressed={value.includes(code)}
            disabled={disabled}
            onClick={() => toggle(code)}
            data-testid={`service-category-${code}`}
          >
            {getServiceCategoryLabel(code, t)}
          </Button>
        ))}
      </div>
      {unknown.length > 0 && (
        <p className="text-xs text-amber-700" data-testid="service-categories-unknown">
          {t('serviceCategories.unknownWillBeRemoved', { values: unknown.join(', ') })}
        </p>
      )}
    </div>
  );
}

interface ServiceCategorySelectProps {
  id?: string;
  value: string;
  onChange: (code: string) => void;
  /** Label of an empty first option ("all categories"); without it a category is always selected. */
  emptyOptionLabel?: string;
  'data-testid'?: string;
}

/** Single choice of a service category from the backend catalog, with loading and error states. */
export function ServiceCategorySelect({
  id,
  value,
  onChange,
  emptyOptionLabel,
  'data-testid': testId,
}: ServiceCategorySelectProps) {
  const { t } = useTranslation();
  const { data: codes, isLoading, isError, refetch } = useServiceCategories();

  if (isLoading) return <CatalogLoading />;
  if (isError || !codes) return <CatalogError onRetry={() => void refetch()} />;

  return (
    <select id={id} className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId}>
      {emptyOptionLabel !== undefined && <option value="">{emptyOptionLabel}</option>}
      {codes.map((code) => (
        <option key={code} value={code}>
          {getServiceCategoryLabel(code, t)}
        </option>
      ))}
    </select>
  );
}
