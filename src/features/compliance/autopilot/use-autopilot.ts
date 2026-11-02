import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { complianceAutopilotApi } from '@/api/compliance-autopilot.api';
import type { AutopilotRunCommand } from '@/types/compliance-autopilot.types';

const COMPLIANCE_KEY = 'compliance';

/**
 * What the assistant would do now: read again every time the layer opens, because the stays, the check-ins and the guests change it from
 * other screens and from the guests' own phones. Nothing is changed and nobody is contacted by reading it.
 */
export function useAutopilotPlan(enabled: boolean) {
  return useQuery({
    queryKey: [COMPLIANCE_KEY, 'autopilot', 'plan'],
    queryFn: complianceAutopilotApi.getPlan,
    enabled,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Runs what the plan said, for the items the host was shown. No toast: the layer shows what was done where the host is looking. The
 * cockpit, the bookings and the Alloggiati read again, because the assistant changed them (departures closed, links issued).
 */
export function useRunAutopilot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (command: AutopilotRunCommand) => complianceAutopilotApi.run(command),
    onSettled: () => {
      // The summary only: the plan is read again by the host's «Nuovo controllo», not behind his back while he reads the result.
      void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_KEY, 'summary'] });
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      void queryClient.invalidateQueries({ queryKey: ['alloggiati'] });
    },
  });
}
