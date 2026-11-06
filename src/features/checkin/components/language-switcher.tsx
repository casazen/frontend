import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { GUEST_LOCALE_OPTIONS, type GuestLocale } from '../lib/guest-locale';

interface LanguageSwitcherProps {
  /** The language the page is shown in. */
  value: GuestLocale;
  /** The guest chose another language. */
  onChange: (locale: GuestLocale) => void;
  /** The languages offered, in the order of the page (default: all five). */
  locales?: readonly GuestLocale[];
}

/**
 * The language of the guest check-in page (NF-40, NF-11): always at the top of the page, with a visible label, and the names of the
 * languages written in the language itself ("Deutsch"), each option carrying its own `lang` so that a screen reader says it with the right
 * voice. A native select: it opens and moves with the keyboard (arrows, Enter, Esc), on a phone it is the system picker, and its
 * target is 44 px high.
 */
export function LanguageSwitcher({ value, onChange, locales }: LanguageSwitcherProps) {
  const { t } = useTranslation();
  const selectId = useId();
  const options = GUEST_LOCALE_OPTIONS.filter((option) => !locales || locales.includes(option.locale));

  return (
    <div className="flex items-center justify-end gap-2" data-testid="checkin-language-switcher">
      <Label htmlFor={selectId} className="shrink-0">
        {t('checkin.language.label')}
      </Label>
      <select
        id={selectId}
        value={value}
        onChange={(event) => onChange(event.target.value as GuestLocale)}
        data-testid="checkin-language-select"
        className="flex h-11 min-w-[9rem] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {options.map((option) => (
          <option key={option.locale} value={option.locale} lang={option.locale}>
            {t(option.nameKey)}
          </option>
        ))}
      </select>
    </div>
  );
}
