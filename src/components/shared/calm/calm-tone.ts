import { AlertCircle, AlertTriangle, CheckCircle2, Compass, Info, type LucideIcon } from 'lucide-react';

/**
 * How a calm block feels, from "this is just where to go next" (`neutral`, the accent of the area) to "this cannot wait"
 * (`danger`). Color is only one of three signals: every tone has its own icon, and the words of the block say the rest.
 */
export type CalmTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

interface ToneStyle {
  /** The round badge of the icon: the soft color of the tone. */
  badge: string;
  /** Text and icon of the tone on the page and on `badge`: `-foreground` on `-soft` and on the surfaces meets AA (`styles/__tests__/tokens.test.ts`). */
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

/** Every tone, in the order of the table above (it cannot fall behind it: the keys are the tones). */
export const CALM_TONES = Object.keys(TONE_STYLES) as CalmTone[];
