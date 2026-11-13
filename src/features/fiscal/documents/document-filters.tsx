import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  DOCUMENT_DAY_LIMITS,
  DOCUMENT_KIND_OPTIONS,
  DOCUMENT_SOURCE_OPTIONS,
  DOCUMENT_STATUS_OPTIONS,
  hasActiveFilters,
  type DocumentFilters,
  type PeriodProblem,
} from './document-model';

interface DocumentFilterBarProps {
  filters: DocumentFilters;
  /** What is wrong with the days, or `null`: the page does not ask the server for a period it would refuse, and says why here. */
  problem: PeriodProblem | null;
  onChange: (filters: DocumentFilters) => void;
  onReset: () => void;
}

/**
 * The filters of the list (FIS-04): the period (the days of the issue, both included), the kind (invoice, credit note, receipt, proforma), who issued it («emessi da CasaZen»,
 * «dal tuo channel manager») and the status (draft, issued, dropped draft). The filters are in the page and nowhere else: not in the address, not in the browser's storage.
 */
export function DocumentFilterBar({ filters, problem, onChange, onReset }: DocumentFilterBarProps) {
  const { t } = useTranslation();
  const set = (part: keyof DocumentFilters, value: string) => onChange({ ...filters, [part]: value });

  return (
    <div className="space-y-3" data-testid="fiscal-documents-filters">
      <div role="group" aria-label={t('fiscalDocuments.list.filters.label')} className="flex flex-wrap items-end gap-3">
        <Field label={t('fiscalDocuments.list.filters.from')} className="w-full sm:w-44">
          <Input
            type="date"
            value={filters.from}
            min={DOCUMENT_DAY_LIMITS.min}
            max={DOCUMENT_DAY_LIMITS.max}
            onChange={(event) => set('from', event.target.value)}
            data-testid="fiscal-documents-from"
          />
        </Field>
        <Field label={t('fiscalDocuments.list.filters.to')} className="w-full sm:w-44">
          <Input
            type="date"
            value={filters.to}
            min={DOCUMENT_DAY_LIMITS.min}
            max={DOCUMENT_DAY_LIMITS.max}
            onChange={(event) => set('to', event.target.value)}
            data-testid="fiscal-documents-to"
          />
        </Field>
        <Field label={t('fiscalDocuments.list.filters.kind')} className="w-full sm:w-48">
          <Select value={filters.kind} onChange={(event) => set('kind', event.target.value)} data-testid="fiscal-documents-kind">
            <option value="">{t('fiscalDocuments.list.filters.all')}</option>
            {DOCUMENT_KIND_OPTIONS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`fiscalDocuments.list.kind.${kind}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('fiscalDocuments.list.filters.source')} className="w-full sm:w-56">
          <Select value={filters.source} onChange={(event) => set('source', event.target.value)} data-testid="fiscal-documents-source">
            <option value="">{t('fiscalDocuments.list.filters.all')}</option>
            {DOCUMENT_SOURCE_OPTIONS.map((source) => (
              <option key={source} value={source}>
                {t(`fiscalDocuments.list.source.${source}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('fiscalDocuments.list.filters.status')} className="w-full sm:w-48">
          <Select value={filters.status} onChange={(event) => set('status', event.target.value)} data-testid="fiscal-documents-status">
            <option value="">{t('fiscalDocuments.list.filters.all')}</option>
            {DOCUMENT_STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {t(`fiscalDocuments.list.filters.statuses.${status}`)}
              </option>
            ))}
          </Select>
        </Field>
        {hasActiveFilters(filters) ? (
          <Button type="button" variant="ghost" size="sm" onClick={onReset} data-testid="fiscal-documents-reset">
            {t('fiscalDocuments.list.filters.reset')}
          </Button>
        ) : null}
      </div>

      {problem ? (
        <p role="alert" className="text-sm text-destructive" data-testid="fiscal-documents-period-problem" data-problem={problem}>
          {t(problem === 'order' ? 'fiscalDocuments.list.filters.dateOrder' : 'fiscalDocuments.list.filters.dateRange')}
        </p>
      ) : null}
    </div>
  );
}
