import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { COMUNE_SEARCH_MIN_LENGTH } from '@/api/comuni.api';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { comuneLabel } from '@/lib/comune-label';
import { useComuneDatasetStatus, useComuneSearch } from '@/queries/use-comuni';
import type { Comune } from '@/types/comune.types';

/** Pause in typing before the search is sent: one request per word, not per key. */
const SEARCH_DEBOUNCE_MS = 250;

interface FinderComuneFieldProps {
  /** Id of the input: the label of the field points at it. */
  id: string;
  value: Comune | null;
  onChange: (comune: Comune | null) => void;
}

/**
 * The "Dove?" of the finder: an accessible autocomplete (ARIA combobox with a listbox, arrow keys, Enter, Escape) on the official
 * ISTAT list, in the look of the site. It gives back the comune picked; clearing the field gives back null. The comune is
 * optional: the finder works without it, the booking asks for it later.
 */
export function FinderComuneField({ id, value, onChange }: FinderComuneFieldProps) {
  const { t } = useTranslation();
  const listboxId = useId();
  const statusId = useId();
  const status = useComuneDatasetStatus();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const query = text.trim();
  const debounced = useDebouncedValue(query, SEARCH_DEBOUNCE_MS);
  const search = useComuneSearch(debounced, typing && status.data?.datasetAvailable === true);
  const items = search.data?.items ?? [];
  const tooShort = query.length < COMUNE_SEARCH_MIN_LENGTH;
  const searching = typing && !tooShort && (query !== debounced || search.isFetching);
  const listVisible = typing && !tooShort && !searching && items.length > 0;
  const active = items.length === 0 ? -1 : Math.min(Math.max(highlighted, 0), items.length - 1);

  const choose = (comune: Comune) => {
    setTyping(false);
    setText('');
    onChange(comune);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && items.length > 0) {
      event.preventDefault();
      setHighlighted((active + 1) % items.length);
    } else if (event.key === 'ArrowUp' && items.length > 0) {
      event.preventDefault();
      setHighlighted(active <= 0 ? items.length - 1 : active - 1);
    } else if (event.key === 'Enter' && listVisible) {
      // Enter picks the highlighted comune; it never sends the finder while the list is open.
      event.preventDefault();
      if (active >= 0) choose(items[active]);
    } else if (event.key === 'Escape' && typing) {
      event.preventDefault();
      setTyping(false);
      setText('');
    }
  };

  let message = '';
  if (typing && !tooShort) {
    if (searching) message = t('comune.picker.searching');
    else if (items.length === 0 && search.isSuccess) message = t('comune.picker.noResults', { query: debounced });
    else if (items.length > 0) message = t('comune.picker.resultCount', { count: items.length });
  }

  return (
    <div
      ref={containerRef}
      onBlur={(event) => {
        // Leaving the field drops what was typed without a choice; the comune already picked stays.
        if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
          setTyping(false);
          setText('');
        }
      }}
    >
      <input
        id={id}
        name="comune"
        type="text"
        role="combobox"
        aria-expanded={listVisible}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={listVisible && active >= 0 ? `${listboxId}-${active}` : undefined}
        aria-describedby={statusId}
        autoComplete="off"
        placeholder={t('supplierSite.finder.comunePlaceholder')}
        value={typing ? text : value ? comuneLabel(value) : ''}
        onChange={(event) => {
          setTyping(true);
          setHighlighted(0);
          setText(event.target.value);
          if (event.target.value === '') onChange(null);
        }}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={onKeyDown}
      />
      {listVisible ? (
        <ul id={listboxId} role="listbox" aria-label={t('comune.picker.listLabel')} className="vz-listbox">
          {items.map((comune, index) => (
            <li
              key={comune.istatCode}
              id={`${listboxId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown, not click: the input must not lose focus (and drop the list) before the choice is made.
              onMouseDown={(event) => {
                event.preventDefault();
                choose(comune);
              }}
              onMouseEnter={() => setHighlighted(index)}
            >
              {comuneLabel(comune)}
              <small>{comune.regionName}</small>
            </li>
          ))}
        </ul>
      ) : null}
      <span id={statusId} className="sr-only" aria-live="polite">
        {message}
      </span>
    </div>
  );
}
