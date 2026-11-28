import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: LucideIcon;
  disabled?: boolean;
  testId?: string;
}

export interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
  testId?: string;
}

export function Segmented<T extends string>({ label, options, value, onValueChange, className, testId }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={testId}
      className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none]', className)}
    >
      {options.map((option) => {
        const pressed = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            disabled={option.disabled}
            data-testid={option.testId}
            onClick={() => {
              if (!pressed) onValueChange(option.value);
            }}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11 pointer-coarse:min-w-11',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
              pressed ? 'bg-background text-foreground shadow-sm' : 'text-foreground/65 hover:text-foreground',
            )}
          >
            {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
