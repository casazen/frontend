import { useTranslation } from 'react-i18next';
import type { PropertyComplianceStatus } from '@/types/compliance.types';
import { ComplianceLight } from './components/compliance-light';
import type { LightState } from './lib/compliance-light';

/**
 * The status of a property in the vocabulary of the lights (icon, color and words, never the color alone): what is active is drawn as
 * the green of «in regola», what waits as the yellow of «in corso», what stopped as the red of «da fare». It says the status in its own
 * word ("Attivo", "In attesa", "Sospeso"), not «in regola»: it is the status of the activation, not the proof a light asks for.
 */
const LOOK: Record<PropertyComplianceStatus, LightState> = {
  Active: 'green',
  Pending: 'yellow',
  Suspended: 'red',
};

interface ComplianceStatusBadgeProps {
  status: PropertyComplianceStatus;
  className?: string;
}

export function ComplianceStatusBadge({ status, className }: ComplianceStatusBadgeProps) {
  const { t } = useTranslation();

  return (
    <ComplianceLight
      state={LOOK[status] ?? 'unknown'}
      label={t(`compliance.status.${status}`)}
      size="lg"
      className={className}
      data-testid="compliance-status-badge"
    />
  );
}
