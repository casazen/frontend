import { cn } from '@/lib/utils';

export interface ChoiceListOption {
  value: string;
  title: string;
  /** What the choice means, in one line. */
  description?: string;
  disabled?: boolean;
  /** `data-testid` of the radio under the row. */
  testId?: string;
}

interface ChoiceListProps {
  /** The question the rows answer: it names the group and is written above it. */
  legend: string;
  name: string;
  options: ChoiceListOption[];
  /** The value chosen, or an empty text while nothing is. */
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/**
 * One question and its answers as ONE quiet block (LR-WIZ-1): a row for each answer, a real radio, the answer in bold and a line under it
 * that says what it means. Not cards side by side — three equal boxes with an icon and a tick each ask the eye to choose before the
 * person has read — but a list that is read from the top. The row chosen is tinted; the whole row is the target, which is at least
 * 44 px high.
 */
export function ChoiceList({ legend, name, options, value, onChange, className }: ChoiceListProps) {
  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0', className)}>
      <legend className="mb-2 text-base font-semibold">{legend}</legend>
      <div className="divide-y overflow-hidden rounded-xl ring-1 ring-inset ring-border">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-14 cursor-pointer items-start gap-3 bg-background p-4 transition-colors hover:bg-muted/40',
              'has-checked:bg-primary/5',
              'has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-ring',
              'has-disabled:cursor-not-allowed has-disabled:opacity-60 has-disabled:hover:bg-background',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
              data-testid={option.testId}
              className="mt-0.5 size-5 shrink-0 accent-primary"
            />
            <span className="min-w-0">
              <span className="block break-words font-semibold leading-snug">{option.title}</span>
              {option.description ? <span className="mt-0.5 block break-words text-sm text-foreground/70">{option.description}</span> : null}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
