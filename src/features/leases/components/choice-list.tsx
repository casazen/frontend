import { cn } from '@/lib/utils';

export interface ChoiceListOption {
  value: string;
  title: string;
  description?: string;
  disabled?: boolean;
  testId?: string;
}

interface ChoiceListProps {
  legend: string;
  name: string;
  options: ChoiceListOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ChoiceList({ legend, name, options, value, onChange, className }: ChoiceListProps) {
  return (
    <fieldset className={cn('m-0 min-w-0 border-0 p-0', className)}>
      <legend className="mb-3 text-lg font-semibold tracking-tight">{legend}</legend>
      <div className="grid gap-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'flex min-h-16 cursor-pointer items-center gap-4 rounded-xl border bg-card px-4 py-3.5 transition-colors hover:border-primary/50 hover:bg-muted/40',
              'has-checked:border-primary has-checked:bg-primary/5 has-checked:shadow-sm',
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
              className="order-last ml-auto size-5 shrink-0 accent-primary"
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
