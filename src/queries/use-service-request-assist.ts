import { useMutation, useQuery } from '@tanstack/react-query';
import { serviceRequestAssistApi } from '@/api/service-request-assist.api';
import type { ServiceRequestAssistInput } from '@/types/service-request-assist';

const SERVICE_REQUEST_ASSIST_KEY = 'service-request-assist';

export function useRequestAssistAvailability() {
  return useQuery({
    queryKey: [SERVICE_REQUEST_ASSIST_KEY, 'availability'],
    queryFn: () => serviceRequestAssistApi.getAvailability(),
    staleTime: 5 * 60_000,
  });
}

export function useRequestAssist() {
  return useMutation({
    mutationFn: (input: ServiceRequestAssistInput) => serviceRequestAssistApi.assist(input),
  });
}
