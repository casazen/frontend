import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { NoteTone, RowNote } from '../lib/home-model';

const NOTE_ICONS: Record<NoteTone, LucideIcon> = { neutral: Clock, info: Info, success: CheckCircle2, warning: AlertTriangle, danger: AlertCircle };
const NOTE_TEXT: Record<NoteTone, string> = {
  neutral: 'text-foreground/70',
  info: 'text-info-foreground',
  success: 'text-success-foreground',
  warning: 'text-warning-foreground',
  danger: 'text-danger-foreground',
};

/**
 * A line with a tone: its icon and its words say it, the color is never the only signal. The rows of the Home use it, and the
 * pages of the adempimenti too.
 */
export function NoteLine({ note }: { note: RowNote }) {
  const Icon = NOTE_ICONS[note.tone];
  return (
    <span className={cn('inline-flex items-start gap-1.5 text-sm font-medium', NOTE_TEXT[note.tone])}>
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="min-w-0 break-words">{note.text}</span>
    </span>
  );
}
