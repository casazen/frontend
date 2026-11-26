import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { TONE_STYLES, type CalmTone } from './calm-tone';

interface ContextualHintProps {
  label: string;
  tone?: CalmTone;
  testId?: string;
  children: ReactNode;
}

export function ContextualHint({ label, tone = 'info', testId, children }: ContextualHintProps) {
  const { Icon, accent } = TONE_STYLES[tone];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" data-testid={testId} className="inline-flex min-h-10 min-w-0 max-w-full items-center gap-2 rounded-lg px-2 text-start text-sm font-medium hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          <Icon aria-hidden="true" className={cn('size-4 shrink-0', accent)} />
          <span className="min-w-0 break-words">{label}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label={label} className="max-h-[var(--radix-popover-content-available-height)] w-96 overflow-y-auto">
        {children}
      </PopoverContent>
    </Popover>
  );
}
