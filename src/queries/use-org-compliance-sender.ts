import { useQuery } from '@tanstack/react-query';
import { orgComplianceSenderApi } from '@/api/org-compliance-sender.api';

export const ORG_COMPLIANCE_SENDER_KEY = ['org-compliance-sender'] as const;

export function useOrgComplianceSender(enabled = true) {
  return useQuery({
    queryKey: ORG_COMPLIANCE_SENDER_KEY,
    queryFn: orgComplianceSenderApi.get,
    enabled,
    refetchOnMount: 'always',
  });
}
