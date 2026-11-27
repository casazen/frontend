import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { onboardingApi } from '@/api/onboarding.api';
import { onboardingAssistApi } from '@/api/onboarding-assist.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import type { CreateAssistRequest } from '@/types/onboarding.types';
import { invalidateOnboarding } from './use-onboarding-plan';
import { PANEL_STEPS_KEY } from './use-onboarding-panel-step';

export const ASSIST_REQUESTS_KEY = ['onboarding', 'assist-requests'] as const;

export function useAssistRequests(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ASSIST_REQUESTS_KEY,
    queryFn: () => onboardingApi.listAssistRequests(),
    enabled: options?.enabled ?? true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
  });
}

export function useRequestAssist() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: CreateAssistRequest) => onboardingApi.requestAssist(request),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ASSIST_REQUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: PANEL_STEPS_KEY });
      invalidateOnboarding(queryClient);
    },
  });
}

interface ReopenVariables {
  id: string;
  note: string;
}

export function useReopenAssistRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: ReopenVariables) => {
      try {
        return await onboardingAssistApi.reopenRequest(id, note);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ASSIST_REQUESTS_KEY });
      void queryClient.invalidateQueries({ queryKey: PANEL_STEPS_KEY });
      invalidateOnboarding(queryClient);
    },
  });
}
