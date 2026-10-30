import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Qty } from '@/components/ui/qty';
import { Switch } from '@/components/ui/switch';
import { ChildrenAgesFields } from '@/features/tourist-tax/components/children-ages-fields';
import { MINOR_MAX_AGE } from '@/lib/tourist-tax';
import { cn } from '@/lib/utils';
import './stay-pickers.css';

/** Most people a picker offers when the home does not say its own limit. */
export const DEFAULT_MAX_GUESTS = 16;

/** Who is coming: how many adults and children, and whether a pet comes. */
export interface GuestsValue {
  adults: number;
  children: number;
  pets: boolean;
}

export interface GuestsPickerProps {
  value: GuestsValue;
  onChange: (next: GuestsValue) => void;
  /** Most people the home takes, adults and children together. */
  maxGuests?: number;
  /** The home takes pets: only then the switch is there. */
  petsAllowed?: boolean;
  /**
   * The age of each child (null until chosen), asked only when the page needs it (the tourist tax of some comuni depends on it,
   * DB-05): the picker does not require it, it draws the fields when the page gives the ages and what to do with a change.
   */
  childrenAges?: (number | null)[];
  onChildrenAgesChange?: (ages: (number | null)[]) => void;
  className?: string;
}

/**
 * The guests of a stay (DB-20): adults (at least one), children, and a pet when the home takes them, with the buttons of `Qty`
 * of 44 px. The two counts share the room of the home: when it is full the buttons that would go past it stop and a sentence says
 * how many people the home takes. The ids come from `useId`, so the same picker can be on the page twice (the card and the sheet)
 * without two elements sharing one.
 */
export function GuestsPicker({
  value,
  onChange,
  maxGuests = DEFAULT_MAX_GUESTS,
  petsAllowed = false,
  childrenAges,
  onChildrenAgesChange,
  className,
}: GuestsPickerProps) {
  const { t } = useTranslation();
  const uid = useId();
  const total = value.adults + value.children;
  const full = total >= maxGuests;

  return (
    <div className={cn('stay-guests', className)} data-testid="guests-picker">
      <div className="stay-guests__row">
        <div className="stay-guests__text">
          <span className="stay-guests__name">{t('stayPickers.guests.adults')}</span>
          <span className="stay-guests__hint">{t('stayPickers.guests.adultsHint', { age: MINOR_MAX_AGE + 1 })}</span>
        </div>
        <Qty
          label={t('stayPickers.guests.adults')}
          value={value.adults}
          min={1}
          max={Math.max(1, maxGuests - value.children)}
          onChange={(adults) => onChange({ ...value, adults })}
          testId="guests-adults"
        />
      </div>

      <div className="stay-guests__row">
        <div className="stay-guests__text">
          <span className="stay-guests__name">{t('stayPickers.guests.children')}</span>
          <span className="stay-guests__hint">{t('stayPickers.guests.childrenHint', { age: MINOR_MAX_AGE })}</span>
        </div>
        <Qty
          label={t('stayPickers.guests.children')}
          value={value.children}
          min={0}
          max={Math.max(0, maxGuests - value.adults)}
          onChange={(children) => onChange({ ...value, children })}
          testId="guests-children"
        />
      </div>

      {petsAllowed ? (
        <div className="stay-guests__row">
          <div className="stay-guests__text">
            <label htmlFor={`${uid}-pets`} className="stay-guests__name">
              {t('stayPickers.guests.pets')}
            </label>
            <span id={`${uid}-pets-hint`} className="stay-guests__hint">
              {t('stayPickers.guests.petsHint')}
            </span>
          </div>
          <span className="inline-flex h-11 items-center">
            <Switch
              id={`${uid}-pets`}
              checked={value.pets}
              onCheckedChange={(pets) => onChange({ ...value, pets })}
              aria-describedby={`${uid}-pets-hint`}
              data-testid="guests-pets"
            />
          </span>
        </div>
      ) : null}

      {childrenAges && onChildrenAgesChange && value.children > 0 ? (
        <div className="pb-2 pt-1">
          <ChildrenAgesFields ages={childrenAges} onChange={onChildrenAgesChange} idPrefix={`${uid}-ages`} />
        </div>
      ) : null}

      <p className="stay-guests__limit" role="status" data-testid="guests-limit">
        {full ? t('stayPickers.guests.limit', { count: maxGuests }) : ''}
      </p>
    </div>
  );
}
