import type { LucideIcon } from 'lucide-react';
import { TONE_STYLES, type CalmTone } from '@/components/shared/calm/calm-tone';
import { cn } from '@/lib/utils';

export function ToneTile({ icon: Icon, tone, className }: { icon: LucideIcon; tone: CalmTone; className?: string }) {
  const style = TONE_STYLES[tone];
  return (
    <span aria-hidden="true" className={cn('cz-icon-tile', style.badge, style.accent, className)}>
      <Icon strokeWidth={1.75} />
    </span>
  );
}
