import { useEffect, useId, useState, type InputHTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import type { AlloggiatiCodeList } from '@/types/public-checkin.types';
import { codeEntryLabel, isListAvailable, type CodeTableSource, type CodeTableValue } from './code-table';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 250;

interface CodeTableInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> {
  id: string;
  list: AlloggiatiCodeList;
  source: CodeTableSource;
  name: string;
  code: string | null;
  onValueChange: (value: CodeTableValue) => void;
}

function useDelayedValue(value: string, delay: number): string {
  const [delayed, setDelayed] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDelayed(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return delayed;
}

/**
 * Text field for a place, citizenship or document type. When the official table is imported it suggests its entries
 * and keeps the code of the chosen one; otherwise (or when the guest types something else) only the name is kept and
 * the code stays to complete (CO-12). A failed search never looks like "no result": the guest is told to type the name.
 */
export function CodeTableInput({ id, list, source, name, code, onValueChange, ...inputProps }: CodeTableInputProps) {
  const { t } = useTranslation();
  const datalistId = useId();
  const available = isListAvailable(source, list);
  const query = useDelayedValue(name.trim(), SEARCH_DELAY_MS);
  const search = useQuery({
    queryKey: ['alloggiati-codes', source.scope, list, query],
    queryFn: () => source.search(list, query),
    enabled: available && query.length >= MIN_QUERY_LENGTH,
    staleTime: 5 * 60 * 1000,
  });
  const entries = search.data ?? [];

  const handleChange = (value: string) => {
    const entry = entries.find((candidate) => codeEntryLabel(candidate) === value);
    if (entry) onValueChange({ name: entry.description, code: entry.code, province: entry.province ?? null });
    else onValueChange({ name: value, code: null });
  };

  return (
    <>
      <Input
        id={id}
        autoComplete="off"
        value={name}
        list={available ? datalistId : undefined}
        onChange={(event) => handleChange(event.target.value)}
        {...inputProps}
      />
      {available && (
        <datalist id={datalistId} data-testid={`${id}-options`}>
          {entries.map((entry) => (
            <option key={`${entry.table}-${entry.code}`} value={codeEntryLabel(entry)} />
          ))}
        </datalist>
      )}
      {available && code && (
        <p className="text-xs text-muted-foreground" data-testid={`${id}-code`}>
          {t('checkin.codeSelected', { code })}
        </p>
      )}
      {available && search.isError && (
        <p className="text-xs text-orange-700" role="status" data-testid={`${id}-search-error`}>
          {t('checkin.codeSearchFailed')}
        </p>
      )}
    </>
  );
}
