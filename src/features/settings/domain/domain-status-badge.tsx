import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { DomainVerificationStatus } from '@/types/domain.types';
import { getDomainState, type DomainState } from './domain-state';

interface DomainStatusBadgeProps {
  status: DomainVerificationStatus;
  /** Why the domain is not verified (backend code): tells "waiting for DNS" from "activating". */
  detail?: string | null;
}

const VARIANTS: Record<DomainState, 'default' | 'secondary' | 'destructive'> = {
  verified: 'default',
  waitingDns: 'secondary',
  activating: 'secondary',
  failed: 'destructive',
};

export function DomainStatusBadge({ status, detail }: DomainStatusBadgeProps) {
  const { t } = useTranslation();
  const state = getDomainState(status, detail);

  return (
    <Badge variant={VARIANTS[state]} data-testid="domain-status-badge" data-state={state}>
      {t(`domain.state.${state}`)}
    </Badge>
  );
}
