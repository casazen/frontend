import { useMutation, useQueryClient } from '@tanstack/react-query';
import { propertiesApi } from '@/api/properties.api';
import { ME_QUERY_KEY } from '@/lib/onboarding-gate';
import { ENTITLEMENT_QUERY_KEY } from '@/queries/use-users';
import type { CreatePropertyDto, UpdatePropertyDto } from '@/types';

const PROPERTIES_KEY = 'properties';

/**
 * Creates the property at the end of the first step (SR-D11): always a short-stay one, the mode is sent and never inferred. It says
 * nothing by itself — no toast: the wizard shows what went wrong where the person is looking, and the next step is the confirmation.
 * The lists, the plan usage and the profile (`hasProperties`, which the onboarding guard reads) are read again.
 */
export function useWizardCreateProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePropertyDto) => propertiesApi.create({ ...data, rentalMode: 'Short' }),
    onSuccess: async () => {
      void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      void queryClient.invalidateQueries({ queryKey: ENTITLEMENT_QUERY_KEY });
      await queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY });
    },
  });
}

export function useWizardSaveProperty() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePropertyDto }) => propertiesApi.update(id, data),
    onSuccess: (_result, { id }) => {
      void queryClient.invalidateQueries({ queryKey: [PROPERTIES_KEY] });
      void queryClient.invalidateQueries({ queryKey: ['compliance', 'activation', id] });
    },
  });
}
