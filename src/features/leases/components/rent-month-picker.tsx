import { useId } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { monthChoices, monthName } from '../lib/rent-register';

interface RentMonthPickerProps {
  /** The month shown, `yyyy-MM`. */
  month: string;
  /** This month in Rome: the choices are the last twelve months, this one and the next three around it. */
  currentMonth: string;
  onChange: (month: string) => void;
}

/** The month of the register: an arrow each way and the list of the months, one control for the keyboard and one for the finger. */
export function RentMonthPicker({ month, currentMonth, onChange }: RentMonthPickerProps) {
  const { t, i18n } = useTranslation();
  const selectId = useId();
  const months = monthChoices(currentMonth, month);
  const index = months.indexOf(month);
  const previous = months[index - 1];
  const next = months[index + 1];

  return (
    <div role="group" aria-label={t('longRentRents.month.group')} className="flex min-w-0 flex-wrap items-center gap-2" data-testid="rent-month-picker">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('longRentRents.month.previous')}
        disabled={previous === undefined}
        onClick={() => previous !== undefined && onChange(previous)}
        data-testid="rent-month-previous"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Button>
      <label htmlFor={selectId} className="sr-only">
        {t('longRentRents.month.label')}
      </label>
      <Select id={selectId} value={month} wrapperClassName="w-52" onChange={(event) => onChange(event.target.value)} data-testid="rent-month-select">
        {months.map((value) => (
          <option key={value} value={value}>
            {monthName(value, i18n.language)}
          </option>
        ))}
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('longRentRents.month.next')}
        disabled={next === undefined}
        onClick={() => next !== undefined && onChange(next)}
        data-testid="rent-month-next"
      >
        <ChevronRight className="size-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
