import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { comuneLabel } from '@/lib/comune-label';
import { COMUNE_SEARCH_MIN_LENGTH } from '@/api/comuni.api';
import { useComune, useComuneDatasetStatus, useComuneSearch } from '@/queries/use-comuni';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { Comune } from '@/types/comune.types';

/** Pause in typing before the search is sent: one request per word, not per key. */
const SEARCH_DEBOUNCE_MS = 250;

interface ComunePickerProps {
  /** Id of the input: the caller's `<Label htmlFor>` points at it. */
  id: string;
  /** ISTAT code of the comune chosen (text, leading zeros kept), or null when none is. */
  istatCode: string | null;
  /** Called with the comune picked from the list, or null when the choice is cleared. */
  onChange: (comune: Comune | null) => void;
  /**
   * What the caller already knows about the chosen comune (e.g. the stored city), shown while its details load or
   * when the API does not know the code any more.
   */
  fallbackName?: string | null;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  /** `aria-describedby` of the input (hints and errors of the caller). */
  describedBy?: string;
  /**
   * Rendered under the "list not available" notice, so the form can still be filled in without the list (a free-text
   * field). Without it the picker only shows the notice.
   */
  unavailableFallback?: ReactNode;
  className?: string;
  'data-testid'?: string;
}

/**
 * Comune picker (SU-04): an accessible autocomplete (ARIA combobox with a listbox, arrow keys, Enter, Escape) on the
 * official ISTAT list. It stores the ISTAT code; the region follows the comune and is shown, never chosen. States: loading
 * the list, search in progress, no match, error (with a retry, never shown as "no result") and "list not available" (the
 * list is not imported on the backend: nothing is offered and the form can fall back to free text).
 */
export function ComunePicker({
  id,
  istatCode,
  onChange,
  fallbackName,
  disabled = false,
  invalid = false,
  placeholder,
  describedBy,
  unavailableFallback,
  className,
  'data-testid': testId = 'comune-picker',
}: ComunePickerProps) {
  const { t } = useTranslation();
  const listboxId = useId();
  const statusId = useId();
  const status = useComuneDatasetStatus();

  // The comune picked in this session is known at once; a stored code is read from the API.
  const [picked, setPicked] = useState<Comune | null>(null);
  const stored = useComune(istatCode && picked?.istatCode !== istatCode ? istatCode : null);
  const chosen: Comune | null = istatCode
    ? picked?.istatCode === istatCode
      ? picked
      : (stored.data ?? null)
    : null;

  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const debounced = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS);
  const search = useComuneSearch(debounced, typing && status.data?.datasetAvailable === true);
  const items = search.data?.items ?? [];
  const containerRef = useRef<HTMLDivElement>(null);

  // A search that answers "list not available" after the status said it was: the list was removed meanwhile.
  const datasetAvailable = status.data?.datasetAvailable === true && search.data?.datasetAvailable !== false;

  // The highlighted option, kept inside the list whatever the answers that arrive meanwhile.
  const activeIndex = items.length === 0 ? -1 : Math.min(Math.max(highlighted, 0), items.length - 1);

  const choose = (comune: Comune) => {
    setPicked(comune);
    setText('');
    setTyping(false);
    setOpen(false);
    onChange(comune);
  };

  const clear = () => {
    setPicked(null);
    setText('');
    setTyping(false);
    setOpen(false);
    onChange(null);
  };

  const stopTyping = () => {
    setTyping(false);
    setOpen(false);
    setText('');
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setHighlighted(items.length === 0 ? 0 : (activeIndex + 1) % items.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setHighlighted(items.length === 0 ? 0 : activeIndex <= 0 ? items.length - 1 : activeIndex - 1);
    } else if (event.key === 'Enter') {
      // Never submits the form while the list is open: Enter picks the highlighted comune.
      if (open && activeIndex >= 0 && items[activeIndex]) {
        event.preventDefault();
        choose(items[activeIndex]);
      } else if (open) {
        event.preventDefault();
      }
    } else if (event.key === 'Escape' && (open || typing)) {
      event.preventDefault();
      stopTyping();
    }
  };

  // The list of the comuni is loading, or could not be checked: said as it is, never as "not available".
  if (status.isPending) {
    return (
      <div className={cn('space-y-1', className)} data-testid={testId}>
        <Input id={id} disabled value="" placeholder={t('comune.picker.loadingList')} readOnly aria-busy="true" />
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status" data-testid="comune-picker-loading-list">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          {t('comune.picker.loadingList')}
        </p>
      </div>
    );
  }

  if (status.isError) {
    return (
      <div className={cn('space-y-2', className)} data-testid={testId}>
        <Input id={id} disabled value="" readOnly aria-invalid />
        <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert" data-testid="comune-picker-status-error">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('comune.picker.statusError')}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void status.refetch()}>
            {t('comune.picker.retry')}
          </Button>
        </div>
        {unavailableFallback}
      </div>
    );
  }

  if (!datasetAvailable) {
    return (
      <div className={cn('space-y-2', className)} data-testid={testId}>
        <div
          className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
          data-testid="comune-picker-unavailable"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">{t('comune.picker.unavailableTitle')}</p>
            <p>{t('comune.picker.unavailableDescription')}</p>
          </div>
        </div>
        {unavailableFallback}
      </div>
    );
  }

  const trimmed = text.trim();
  const tooShort = trimmed.length < COMUNE_SEARCH_MIN_LENGTH;
  const searching = typing && !tooShort && (trimmed !== debounced || search.isFetching);
  const showError = typing && !tooShort && search.isError && !search.isFetching;
  const noMatch = typing && !tooShort && !searching && !search.isError && search.isSuccess && items.length === 0;
  const listVisible = open && typing && !tooShort && items.length > 0;
  const shownValue = typing ? text : chosen ? comuneLabel(chosen) : (fallbackName ?? '');

  let liveMessage = '';
  if (typing && tooShort && trimmed.length > 0) liveMessage = t('comune.picker.minChars', { count: COMUNE_SEARCH_MIN_LENGTH });
  else if (searching) liveMessage = t('comune.picker.searching');
  else if (showError) liveMessage = t('comune.picker.searchError');
  else if (noMatch) liveMessage = t('comune.picker.noResults', { query: debounced });
  else if (listVisible) liveMessage = t('comune.picker.resultCount', { count: items.length });

  return (
    <div
      ref={containerRef}
      className={cn('relative space-y-1', className)}
      data-testid={testId}
      onBlur={(event) => {
        // Leaving the picker drops what was typed without a choice; the choice already made stays.
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) stopTyping();
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          id={id}
          role="combobox"
          aria-expanded={listVisible}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={listVisible && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-describedby={[describedBy, statusId].filter(Boolean).join(' ')}
          aria-invalid={invalid || undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder ?? t('comune.picker.placeholder')}
          value={shownValue}
          onChange={(event) => {
            setTyping(true);
            setOpen(true);
            setHighlighted(0);
            setText(event.target.value);
          }}
          onFocus={(event) => {
            // Start from an empty query: the chosen comune stays until another is picked or the field is cleared.
            if (!typing) event.currentTarget.select();
          }}
          onKeyDown={onKeyDown}
          data-testid="comune-picker-input"
        />
        {(istatCode || fallbackName) && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            aria-label={t('comune.picker.clear')}
            data-testid="comune-picker-clear"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {listVisible && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t('comune.picker.listLabel')}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          data-testid="comune-picker-list"
        >
          {items.map((comune, index) => (
            <li
              key={comune.istatCode}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              data-testid={`comune-option-${comune.istatCode}`}
              className={cn('cursor-pointer rounded-sm px-2 py-1.5', index === activeIndex && 'bg-accent text-accent-foreground')}
              // mousedown, not click: the input must not lose focus (and drop the list) before the choice is made.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(comune);
              }}
              onMouseEnter={() => setHighlighted(index)}
            >
              <span className="font-medium">{comuneLabel(comune)}</span>
              {comune.displayName !== comune.name && (
                <span className="text-muted-foreground"> · {comune.displayName}</span>
              )}
              <span className="block text-xs text-muted-foreground">{comune.regionName}</span>
            </li>
          ))}
        </ul>
      )}

      <div id={statusId} aria-live="polite" className="min-h-4 text-xs text-muted-foreground" data-testid="comune-picker-status">
        {searching && (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {liveMessage}
          </span>
        )}
        {!searching && !showError && liveMessage}
      </div>

      {showError && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert" data-testid="comune-picker-search-error">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('comune.picker.searchError')}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void search.refetch()}>
            {t('comune.picker.retry')}
          </Button>
        </div>
      )}

      {!typing && chosen && (
        <p className="text-xs text-muted-foreground" data-testid="comune-picker-region">
          {t('comune.picker.derivedRegion', { region: chosen.regionName })}
        </p>
      )}
      {!typing && chosen && !chosen.isActive && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800" role="status" data-testid="comune-picker-inactive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('comune.picker.notInList')}
        </p>
      )}
      {!typing && istatCode && !chosen && stored.isError && (
        <p className="flex items-start gap-1.5 text-xs text-amber-800" role="status" data-testid="comune-picker-unknown-code">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('comune.picker.codeUnknown', { code: istatCode })}
        </p>
      )}
    </div>
  );
}
