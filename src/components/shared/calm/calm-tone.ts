import { AlertCircle, AlertTriangle, CheckCircle2, Compass, Info, type LucideIcon } from 'lucide-react';

export type CalmTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface ToneStyle {
  badge: string;
  accent: string;
  Icon: LucideIcon;
}

// The semantic tokens of the redesign (`--color-{info,success,warning,danger}-{soft,border,foreground}`, `--color-primary-soft`
// and `--color-primary-text`), as `Alert` and `StatusBadge` read them. `neutral` follows the accent of the area.
export const TONE_STYLES: Record<CalmTone, ToneStyle> = {
  neutral: { badge: 'bg-primary-soft', accent: 'text-primary-text', Icon: Compass },
  info: { badge: 'bg-info-soft', accent: 'text-info-foreground', Icon: Info },
  success: { badge: 'bg-success-soft', accent: 'text-success-foreground', Icon: CheckCircle2 },
  warning: { badge: 'bg-warning-soft', accent: 'text-warning-foreground', Icon: AlertTriangle },
  danger: { badge: 'bg-danger-soft', accent: 'text-danger-foreground', Icon: AlertCircle },
};

export const CALM_TONES = Object.keys(TONE_STYLES) as CalmTone[];
