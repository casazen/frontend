import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import type { AlloggiatiCodeList } from '@/types/public-checkin.types';
import { citizenshipAdjective } from './citizenship-label';
import { codeEntryLabel, isListAvailable, type CodeTableSource, type CodeTableValue } from './code-table';

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 250;

interface CodeTableInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> {
  id: string;
  list: AlloggiatiCodeList;
  source: CodeTableSource;
  name: string;
  code: string | null;
  purpose?: 'place' | 'citizenship';
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

export function CodeTableInput({
  id,
  list,
  source,
  name,
  code,
  purpose = 'place',
  onValueChange,
  ...inputProps
}: CodeTableInputProps) {
  const { t } = useTranslation();
  const available = isListAvailable(source, list);
  const shown = purpose === 'citizenship' ? citizenshipAdjective(name) : name;
  const query = useDelayedValue(name.trim(), SEARCH_DELAY_MS);
  const search = useQuery({
    queryKey: ['alloggiati-codes', source.scope, list, purpose, query],
    queryFn: () => source.search(list, query),
    enabled: query.length >= MIN_QUERY_LENGTH,
    staleTime: 5 * 60 * 1000,
  });
  const entries = Array.isArray(search.data) ? search.data : [];
  const listId = `${id}-listbox`;

  const choose = (value: string) => {
    const entry = entries.find((candidate) =>
      codeEntryLabel(candidate, purpose) === value
      || candidate.description === value
      || codeEntryLabel(candidate) === value);
    if (entry) onValueChange({ name: entry.description, code: entry.code, province: entry.province ?? null });
    else onValueChange({ name: value, code: null });
  };

  return (
    <div className="group relative">
      <Input
        id={id}
        name={id}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={entries.length > 0 && !code}
        aria-controls={listId}
        aria-autocomplete="list"
        value={shown}
        onChange={(event) => choose(event.target.value)}
        {...inputProps}
      />
      {entries.length > 0 && !code && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {entries.map((entry) => {
            const label = codeEntryLabel(entry, purpose);
            return (
              <li key={`${entry.table}-${entry.code}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={entry.code === code}
                  className="w-full rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onValueChange({ name: entry.description, code: entry.code, province: entry.province ?? null });
                  }}
                >
                  {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {code && (
        <p className="text-xs text-muted-foreground" data-testid={`${id}-code`}>
          {t('checkin.codeSelected', { code })}
        </p>
      )}
      {available && search.isError && (
        <p className="text-xs text-orange-700" role="status" data-testid={`${id}-search-error`}>
          {t('checkin.codeSearchFailed')}
        </p>
      )}
    </div>
  );
}
