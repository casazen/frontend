import { useMutation, useQuery } from '@tanstack/react-query';
import { serviceRequestAssistApi } from '@/api/service-request-assist.api';
import type { ServiceRequestAssistInput } from '@/types/service-request-assist';

const SERVICE_REQUEST_ASSIST_KEY = 'service-request-assist';

/**
 * Whether an AI is in effect on the platform (WIZ-AI-REQUEST): the box «Descrivi di cosa hai bisogno» is offered only where it can work.
 * A failed read is no answer: the box stays out of the way and the wizard is the one it always was.
 */
export function useRequestAssistAvailability() {
  return useQuery({
    queryKey: [SERVICE_REQUEST_ASSIST_KEY, 'availability'],
    queryFn: () => serviceRequestAssistApi.getAvailability(),
    staleTime: 5 * 60_000,
  });
}

/** Asks the AI to read the words of the host. No toast: the box shows the answer, or the reason there is none, where the host is looking. */
export function useRequestAssist() {
  return useMutation({
    mutationFn: (input: ServiceRequestAssistInput) => serviceRequestAssistApi.assist(input),
  });
}
