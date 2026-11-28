import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Info, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { getHttpStatus } from '@/lib/api-errors';
import { SWISS_SEARCH_MIN_LENGTH } from '@/api/swiss-places.api';
import { useSwissLocalitySearch, useSwissMunicipality } from '@/queries/swissPlaces';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { SwissLocality } from '@/types/swiss-places.types';
import { fourDigitPostalCode, isSwissPlacesUnavailable, proposeSwissPlace, swissLocalityKey, swissLocalityLabel } from '../lib/swiss-place';

const SEARCH_DEBOUNCE_MS = 250;

interface SwissLocalityPickerProps {
  id: string;
  municipalityCode: string | null;
  postalCode: string;
  city: string;
  stored?: { municipalityCode?: string | null; municipalityName?: string | null; cantonCode?: string | null };
  onChange: (place: SwissLocality | null) => void;
  disabled?: boolean;
  describedBy?: string;
  className?: string;
  'data-testid'?: string;
}

/**
 * Swiss place picker (E29/F01/US02/T01, NF-124): an accessible autocomplete (ARIA combobox with a listbox, arrow keys, Enter, Escape)
 * on the official directory of the Swiss places, searched by postal code or name; items read «6900 Lugano · TI». It hands over the
 * place picked (postal code, name, municipality and canton); the canton follows it and is shown as a quiet label, never chosen.
 *
 * While no place is confirmed it also reads the postal code and the city of the form: a postal code the directory gives one
 * municipality for is proposed and the host confirms it; one it leaves several for (`6900`: Lugano, Massagno, Paradiso) lists the
 * candidates and chooses none. A directory that is not loaded, or that cannot be read, is said as it is (never as "no such place") and
 * never blocks the form: the host saves all the same and confirms the place later.
 */
export function SwissLocalityPicker({
  id,
  municipalityCode,
  postalCode,
  city,
  stored,
  onChange,
  disabled = false,
  describedBy,
  className,
  'data-testid': testId = 'swiss-locality-picker',
}: SwissLocalityPickerProps) {
  const { t } = useTranslation();
  const listboxId = useId();
  const statusId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [picked, setPicked] = useState<SwissLocality | null>(null);
  const pickedFacts = municipalityCode && picked?.municipalityCode === municipalityCode ? picked : null;
  const storedFacts =
    municipalityCode && stored?.municipalityCode === municipalityCode && stored.municipalityName && stored.cantonCode
      ? { municipalityName: stored.municipalityName, cantonCode: stored.cantonCode }
      : null;
  const lookup = useSwissMunicipality(municipalityCode && !pickedFacts && !storedFacts ? municipalityCode : null);
  const lookedUp = lookup.isSuccess ? { municipalityName: lookup.data.name, cantonCode: lookup.data.cantonCode } : null;
  const chosen = municipalityCode ? (pickedFacts ?? storedFacts ?? lookedUp) : null;
  const codeUnknown = !!municipalityCode && lookup.isError && getHttpStatus(lookup.error) === 404;

  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const trimmed = text.trim();
  const debounced = useDebouncedValue(trimmed, SEARCH_DEBOUNCE_MS);
  const search = useSwissLocalitySearch(debounced, typing);
  const items = search.isSuccess ? search.data : [];

  const proposalPostalCode = !municipalityCode && !typing ? fourDigitPostalCode(postalCode) : null;
  const proposalSearch = useSwissLocalitySearch(proposalPostalCode ?? '', proposalPostalCode !== null);
  const proposal = proposalPostalCode && proposalSearch.isSuccess ? proposeSwissPlace(proposalSearch.data, city) : null;

  const searchFailure = typing && search.isError && !search.isFetching ? search.error : null;
  const proposalFailure = proposalPostalCode && proposalSearch.isError && !proposalSearch.isFetching ? proposalSearch.error : null;
  const lookupFailure = municipalityCode && lookup.isError && !codeUnknown && !lookup.isFetching ? lookup.error : null;
  const failure = searchFailure ?? proposalFailure ?? lookupFailure;
  const unavailable = failure !== null && isSwissPlacesUnavailable(failure);
  const retry = () => {
    if (searchFailure) void search.refetch();
    else if (proposalFailure) void proposalSearch.refetch();
    else void lookup.refetch();
  };

  const activeIndex = items.length === 0 ? -1 : Math.min(Math.max(highlighted, 0), items.length - 1);

  const choose = (locality: SwissLocality) => {
    setPicked(locality);
    setText('');
    setTyping(false);
    setOpen(false);
    onChange(locality);
    inputRef.current?.focus();
  };

  const clear = () => {
    setPicked(null);
    setText('');
    setTyping(false);
    setOpen(false);
    onChange(null);
    inputRef.current?.focus();
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

  const tooShort = trimmed.length < SWISS_SEARCH_MIN_LENGTH;
  const searching = typing && !tooShort && (trimmed !== debounced || search.isFetching);
  const proposalSearching = proposalPostalCode !== null && proposalSearch.isFetching && !proposalSearch.isSuccess;
  const noMatch = typing && !tooShort && !searching && search.isSuccess && items.length === 0;
  const listVisible = open && typing && !tooShort && items.length > 0;

  let shownValue = '';
  if (typing) {
    shownValue = text;
  } else if (pickedFacts) {
    shownValue = swissLocalityLabel(pickedFacts);
  } else if (municipalityCode) {
    const place = [postalCode.trim(), city.trim()].filter(Boolean).join(' ') || chosen?.municipalityName || municipalityCode;
    shownValue = chosen ? `${place} · ${chosen.cantonCode}` : place;
  }

  let liveMessage = '';
  if (typing) {
    if (tooShort && trimmed.length > 0) liveMessage = t('swissPlace.picker.minChars', { min: SWISS_SEARCH_MIN_LENGTH });
    else if (searching) liveMessage = t('swissPlace.picker.searching');
    else if (noMatch) liveMessage = t('swissPlace.picker.noResults', { query: debounced });
    else if (listVisible) liveMessage = t('swissPlace.picker.resultCount', { count: items.length });
  } else if (proposalPostalCode) {
    if (proposalSearching) liveMessage = t('swissPlace.picker.searching');
    else if (proposal?.kind === 'none') liveMessage = t('swissPlace.picker.noPostalCode', { postalCode: proposalPostalCode });
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative space-y-1', className)}
      data-testid={testId}
      onBlur={(event) => {
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) stopTyping();
      }}
    >
      <div className="flex items-center gap-2">
        <Input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={listVisible}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={listVisible && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined}
          aria-describedby={[describedBy, statusId].filter(Boolean).join(' ')}
          autoComplete="off"
          disabled={disabled}
          placeholder={t('swissPlace.picker.placeholder')}
          value={shownValue}
          onChange={(event) => {
            setTyping(true);
            setOpen(true);
            setHighlighted(0);
            setText(event.target.value);
          }}
          onFocus={(event) => {
            if (!typing) event.currentTarget.select();
          }}
          onKeyDown={onKeyDown}
          data-testid="swiss-picker-input"
        />
        {municipalityCode && !disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clear}
            aria-label={t('swissPlace.picker.clear')}
            data-testid="swiss-picker-clear"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {listVisible && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={t('swissPlace.picker.listLabel')}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-sm text-popover-foreground shadow-md"
          data-testid="swiss-picker-list"
        >
          {items.map((locality, index) => (
            <li
              key={swissLocalityKey(locality)}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              data-testid={`swiss-locality-option-${locality.postalCode}-${locality.municipalityCode}`}
              className={cn(
                'flex cursor-pointer flex-col justify-center rounded-sm px-2 py-1.5 pointer-coarse:min-h-11',
                index === activeIndex && 'bg-accent text-accent-foreground',
              )}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(locality);
              }}
              onMouseEnter={() => setHighlighted(index)}
            >
              <span className="font-medium">{swissLocalityLabel(locality)}</span>
              {locality.municipalityName !== locality.name && (
                <span className="block text-xs text-muted-foreground">
                  {t('swissPlace.picker.municipalityOf', { municipality: locality.municipalityName })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div id={statusId} aria-live="polite" className="min-h-4 text-xs text-muted-foreground" data-testid="swiss-picker-status">
        {searching || proposalSearching ? (
          <span className="flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {liveMessage}
          </span>
        ) : (
          !failure && liveMessage
        )}
      </div>

      {failure && unavailable && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" role="status" data-testid="swiss-picker-unavailable">
          <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('swissPlace.picker.unavailable')}</span>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={retry}>
            {t('swissPlace.picker.retry')}
          </Button>
        </div>
      )}

      {failure && !unavailable && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert" data-testid="swiss-picker-error">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t('swissPlace.picker.searchError')}</span>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={retry}>
            {t('swissPlace.picker.retry')}
          </Button>
        </div>
      )}

      {!typing && chosen && (
        <p className="text-xs text-muted-foreground" data-testid="swiss-picker-municipality">
          {t('swissPlace.picker.municipality', { municipality: chosen.municipalityName, canton: chosen.cantonCode })}
        </p>
      )}

      {!typing && codeUnknown && municipalityCode && (
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground" role="status" data-testid="swiss-picker-unknown">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {t('swissPlace.picker.codeUnknown', { code: municipalityCode })}
        </p>
      )}

      {proposal?.kind === 'single' && (
        <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="swiss-picker-proposal">
          <span>{t('swissPlace.picker.confirmPrompt', { place: swissLocalityLabel(proposal.locality) })}</span>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => choose(proposal.locality)}>
            {t('swissPlace.picker.confirm')}
          </Button>
        </div>
      )}

      {proposal?.kind === 'ambiguous' && (
        <div className="space-y-2" data-testid="swiss-picker-candidates">
          <p className="text-sm">{t('swissPlace.picker.ambiguous', { postalCode: proposalPostalCode })}</p>
          <ul aria-label={t('swissPlace.picker.candidatesLabel')} className="space-y-1">
            {proposal.candidates.map((locality) => (
              <li key={swissLocalityKey(locality)}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled}
                  className="h-auto min-h-9 w-full flex-col items-start gap-0 whitespace-normal py-1.5 text-left font-normal"
                  onClick={() => choose(locality)}
                  data-testid={`swiss-candidate-${locality.postalCode}-${locality.municipalityCode}`}
                >
                  <span className="font-medium">{swissLocalityLabel(locality)}</span>
                  {locality.municipalityName !== locality.name && (
                    <span className="text-xs text-muted-foreground">
                      {t('swissPlace.picker.municipalityOf', { municipality: locality.municipalityName })}
                    </span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
