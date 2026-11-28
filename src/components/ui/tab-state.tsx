import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TabStateMark {
  tone: 'success' | 'warning';
  label: string;
}

export function TabState({ state }: { state?: TabStateMark }) {
  if (!state) return null;
  const Icon = state.tone === 'success' ? CheckCircle2 : AlertTriangle;
  return (
    <span data-tone={state.tone} className="ms-auto inline-flex shrink-0 items-center">
      <Icon aria-hidden="true" className={cn('size-4', state.tone === 'success' ? 'text-success-foreground' : 'text-warning-foreground')} />
      <span className="sr-only">{`, ${state.label}`}</span>
    </span>
  );
}
