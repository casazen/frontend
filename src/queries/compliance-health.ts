import { useQuery } from '@tanstack/react-query';
import { complianceHealthApi } from '@/api/compliance-health.api';

/** Root of the query key of the connection health: one key per property. */
export const COMPLIANCE_HEALTH_KEY = 'compliance-health';

/**
 * The connection health of the police and ISTAT send of one property (CHK-12 point 7). It changes on other screens and in the channel
 * manager (the host activates the send there and comes back), so every visit of the page reads it again (`'always'`) and a read less than a
 * minute old is fresh. The server reads the police account of the channel manager at each call, so a return to the tab does not read it again:
 * the panel has its own «Controlla di nuovo». `enabled` is false for who may not read the property: nothing is asked then.
 */
export function useConnectionHealth(propertyId: string, enabled = true) {
  return useQuery({
    queryKey: [COMPLIANCE_HEALTH_KEY, propertyId],
    queryFn: () => complianceHealthApi.getConnectionHealth(propertyId),
    enabled: enabled && propertyId !== '',
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
}
