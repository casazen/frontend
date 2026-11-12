import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { GUEST_LOCALE_OPTIONS } from '@/features/checkin/lib/guest-locale';
import { CRM_CHANNELS } from '@/features/crm/lib/crm-labels';
import type { CrmProfileSort } from '@/types/crm.types';
import { PROFILE_SORTS, type EmailFilter, type ProfileFilterPatch, type ProfileFilterState } from './profile-filter-state';

/** How long a text waits after the last key before it goes to the address, ms. */
const TEXT_DEBOUNCE_MS = 350;

/** The minimum of stays the filter offers. */
const MIN_STAYS_CHOICES = [1, 2, 3, 5, 10];

/**
 * A text that is typed: it shows at once and goes to the address, trimmed, a moment after the last key, on Enter or when the field loses
 * the focus. It follows the address when that changes by itself (Back, "Clear filters") and never overwrites what is being typed: the
 * space after "mario" stays in the box while the host goes on with "rossi", though the address has "mario".
 */
function useCommittedText(value: string, onCommit: (text: string) => void) {
  const [draft, setDraft] = useState(value);
  // What this field last sent to the address, and the address it last saw: together they tell a change that came back from here from
  // one that came from elsewhere.
  const [sent, setSent] = useState(value);
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== sent) {
      setDraft(value);
      setSent(value);
    }
  }

  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => {
    const text = draft.trim();
    if (text === sent) return undefined;
    const timer = setTimeout(() => {
      setSent(text);
      commit.current(text);
    }, TEXT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, sent]);

  const flush = () => {
    const text = draft.trim();
    if (text === sent) return;
    setSent(text);
    onCommit(text);
  };
  return { draft, setDraft, flush };
}

interface TextFilterProps {
  label: string;
  value: string;
  onCommit: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
}

/** A text filter of the panel (country, tag). */
function TextFilter({ label, value, onCommit, placeholder, maxLength }: TextFilterProps) {
  const { draft, setDraft, flush } = useCommittedText(value, onCommit);
  return (
    <Field label={label}>
      <Input
        value={draft}
        placeholder={placeholder}
        maxLength={maxLength}
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={flush}
        onKeyDown={(event) => {
          if (event.key === 'Enter') flush();
        }}
      />
    </Field>
  );
}

/** The search box: a part of a name, or a whole e-mail address or phone number. Its hint says so. */
function SearchBox({ value, onCommit }: { value: string; onCommit: (text: string) => void }) {
  const { t } = useTranslation();
  const { draft, setDraft, flush } = useCommittedText(value, onCommit);
  return (
    <form
      role="search"
      className="min-w-0 max-w-xl"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        flush();
      }}
    >
      <Field label={t('crm.filters.search.label')} hint={t('crm.filters.search.hint')}>
        {(control) => (
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/60" aria-hidden="true" />
            <Input
              {...control}
              type="search"
              name="q"
              value={draft}
              placeholder={t('crm.filters.search.placeholder')}
              autoComplete="off"
              className="pl-9"
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
        )}
      </Field>
    </form>
  );
}

/** What the filters tell the page: what changed, and whether it replaces the step of the history (a text being typed) or adds one. */
type OnFilterChange = (patch: ProfileFilterPatch, options?: { replace?: boolean }) => void;

interface FilterPanelProps {
  id: string;
  filters: ProfileFilterState;
  onChange: OnFilterChange;
}

/** The filters that are not always in sight: country, language, the channel booked on, a tag, the minimum of stays, the e-mail. */
function FilterPanel({ id, filters, onChange }: FilterPanelProps) {
  const { t } = useTranslation();
  // The choices of the minimum, and the one the address asks for when it is not among them (a link written by hand).
  const minStays = [...new Set([...MIN_STAYS_CHOICES, ...(filters.minStays === null ? [] : [filters.minStays])])].sort((a, b) => a - b);

  return (
    <div id={id} className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="crm-filters-panel">
      <TextFilter
        label={t('crm.filters.country.label')}
        value={filters.country}
        placeholder={t('crm.filters.country.placeholder')}
        maxLength={100}
        onCommit={(country) => onChange({ country }, { replace: true })}
      />
      <Field label={t('crm.filters.language.label')}>
        <Select value={filters.language} onChange={(event) => onChange({ language: event.target.value })}>
          <option value="">{t('crm.filters.language.all')}</option>
          {GUEST_LOCALE_OPTIONS.map((option) => (
            <option key={option.locale} value={option.locale}>
              {t(option.nameKey)}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('crm.filters.channel.label')}>
        <Select value={filters.channel} onChange={(event) => onChange({ channel: event.target.value })}>
          <option value="">{t('crm.filters.channel.all')}</option>
          {CRM_CHANNELS.map((entry) => (
            <option key={entry.channel} value={entry.channel}>
              {t(entry.labelKey)}
            </option>
          ))}
        </Select>
      </Field>
      <TextFilter
        label={t('crm.filters.tag.label')}
        value={filters.tag}
        placeholder={t('crm.filters.tag.placeholder')}
        maxLength={40}
        onCommit={(tag) => onChange({ tag }, { replace: true })}
      />
      <Field label={t('crm.filters.minStays.label')}>
        <Select
          value={filters.minStays === null ? '' : String(filters.minStays)}
          onChange={(event) => onChange({ minStays: event.target.value ? Number(event.target.value) : null })}
        >
          <option value="">{t('crm.filters.minStays.any')}</option>
          {minStays.map((count) => (
            <option key={count} value={count}>
              {t('crm.filters.minStays.option', { count })}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={t('crm.filters.email.label')}>
        <Select value={filters.email} onChange={(event) => onChange({ email: event.target.value as EmailFilter })}>
          <option value="any">{t('crm.filters.email.any')}</option>
          <option value="reachable">{t('crm.filters.email.reachable')}</option>
          <option value="unreachable">{t('crm.filters.email.unreachable')}</option>
        </Select>
      </Field>
    </div>
  );
}

interface ProfileFiltersProps {
  filters: ProfileFilterState;
  /** How many filters of the panel are on. */
  activeCount: number;
  /** The search or a filter is on. */
  hasFilters: boolean;
  onChange: OnFilterChange;
  onClear: () => void;
}

/**
 * The search, the order and the filters of the list of profiles (E07/F01/US04/T01): country, language, the channel the guest booked on, a
 * tag, the minimum of stays and whether the guest can be written to by e-mail. The search and the order are always in sight; the filters
 * are in a panel that opens by itself when one is on, so that the page is calm until the host needs it. The server narrows everything
 * to the properties the caller reaches; nothing here asks for a document, a birth date or a birth place.
 */
export function ProfileFilters({ filters, activeCount, hasFilters, onChange, onClear }: ProfileFiltersProps) {
  const { t } = useTranslation();
  const panelId = useId();
  const [open, setOpen] = useState(activeCount > 0);

  return (
    <section aria-label={t('crm.filters.region')} className="space-y-4" data-testid="crm-filters">
      <SearchBox value={filters.search} onCommit={(search) => onChange({ search }, { replace: true })} />

      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('crm.filters.sort.label')} className="w-full sm:w-56">
          <Select value={filters.sort} onChange={(event) => onChange({ sort: event.target.value as CrmProfileSort })}>
            {PROFILE_SORTS.map((entry) => (
              <option key={entry.sort} value={entry.sort}>
                {t(entry.labelKey)}
              </option>
            ))}
          </Select>
        </Field>
        <Button
          type="button"
          variant="outline"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((current) => !current)}
          data-testid="crm-filters-toggle"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {activeCount > 0 ? t('crm.filters.panel.buttonActive', { active: activeCount }) : t('crm.filters.panel.button')}
        </Button>
        {hasFilters ? (
          <Button type="button" variant="ghost" onClick={onClear} data-testid="crm-filters-clear">
            {t('crm.filters.clear')}
          </Button>
        ) : null}
      </div>

      {open ? <FilterPanel id={panelId} filters={filters} onChange={onChange} /> : null}
    </section>
  );
}
