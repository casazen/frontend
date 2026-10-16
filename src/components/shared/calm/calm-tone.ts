import { AlertCircle, AlertTriangle, CheckCircle2, Compass, Info, type LucideIcon } from 'lucide-react';

/**
 * How a calm block feels, from "this is just where to go next" (`neutral`, the accent of the area) to "this cannot wait"
 * (`danger`). Color is only one of three signals: every tone has its own icon, and the words of the block say the rest.
 */
export type CalmTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

export const CALM_TONES: readonly CalmTone[] = ['neutral', 'info', 'success', 'warning', 'danger'];

interface ToneStyle {
  /** The soft background and the hairline edge of a block painted in this tone (an inset ring: `border-*` colors are overridden by a global rule today). */
  surface: string;
  /** Text and icon of the tone on `surface` and on the page: `-foreground` is 6:1 and more on both (`tokens.test.ts`). */
  accent: string;
  Icon: LucideIcon;
}

// The semantic tokens of the redesign (`--color-{info,success,warning,danger}-{soft,border,foreground}`, `--color-primary-soft`
// and `--color-primary-text`), as `Alert` and `StatusBadge` read them. `neutral` follows the accent of the area.
export const TONE_STYLES: Record<CalmTone, ToneStyle> = {
  neutral: { surface: 'bg-primary-soft ring-primary/20', accent: 'text-primary-text', Icon: Compass },
  info: { surface: 'bg-info-soft ring-info-border', accent: 'text-info-foreground', Icon: Info },
  success: { surface: 'bg-success-soft ring-success-border', accent: 'text-success-foreground', Icon: CheckCircle2 },
  warning: { surface: 'bg-warning-soft ring-warning-border', accent: 'text-warning-foreground', Icon: AlertTriangle },
  danger: { surface: 'bg-danger-soft ring-danger-border', accent: 'text-danger-foreground', Icon: AlertCircle },
};
