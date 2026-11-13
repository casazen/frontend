import * as React from 'react';
import { AlertCircle, CheckCircle2, CircleDashed, Clock, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { STATUS_TONE_CLASSES } from '@/components/shared/status/status-view';
import type { StatusTone } from '@/lib/status-dictionary';
import { cn } from '@/lib/utils';
import type { LightState } from '../lib/compliance-light';

/** The look of each light: the semantic tokens of the redesign (every pair meets AA) and its own icon, so the color is never the only signal. */
const VIEW: Record<LightState, { tone: StatusTone; Icon: LucideIcon }> = {
  green: { tone: 'success', Icon: CheckCircle2 },
  yellow: { tone: 'warning', Icon: Clock },
  red: { tone: 'danger', Icon: AlertCircle },
  unknown: { tone: 'neutral', Icon: CircleDashed },
};

export interface ComplianceLightProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The light as the row reads it (`lightStateOf`): `unknown` is "da verificare", never green. */
  state: LightState;
  /**
   * Why the item has its light, in plain words (already translated). It is not drawn here: it is in the name of the light for a screen
   * reader ("Da fare: Alloggiati Web non è ancora stato inviato"), and the caller shows it beside the light.
   */
  reason?: string;
  /** Another word than the name of the light, for a state that is not one of the items (the status of a property says "Attivo"). */
  label?: string;
  size?: 'default' | 'lg';
}

/**
 * The traffic light of one item of the compliance cockpit (NF-52, CHK-12): a pill with the color of the light, its own icon and its name
 * in words ("In regola", "In corso", "Da fare", "Da verificare"), so it is never told by color alone. The accessible name carries the reason.
 * It only shows: the action of an item is its own button (at least 44 px), never the light itself. A light the app does not know is
 * "Da verificare": there is no way here to draw a green that the API did not send.
 */
export function ComplianceLight({ state, reason, label, size = 'default', className, ...props }: ComplianceLightProps) {
  const { t } = useTranslation();
  const { tone, Icon } = VIEW[state];
  const name = label ?? t(`compliance.light.${state}`);

  return (
    <span
      role="img"
      aria-label={reason ? t('compliance.light.named', { light: name, reason }) : name}
      data-light={state}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full font-semibold ring-1 ring-inset',
        size === 'lg' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs',
        STATUS_TONE_CLASSES[tone],
        className,
      )}
      {...props}
    >
      <Icon aria-hidden="true" className={cn('shrink-0', size === 'lg' ? 'size-4' : 'size-3.5')} />
      <span className="min-w-0 break-words">{name}</span>
    </span>
  );
}
