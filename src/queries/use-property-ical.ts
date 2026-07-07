import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { propertyIcalApi } from '@/api/property-ical.api';

export function usePropertyIcalStatus(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property-ical', propertyId],
    queryFn: () => propertyIcalApi.getStatus(propertyId!),
    enabled: Boolean(propertyId),
  });
}

export function useSetPropertyIcalImportUrl(propertyId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (importUrl: string) => propertyIcalApi.setImportUrl(propertyId, { importUrl }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['property-ical', propertyId] });
    },
  });
}

export function usePropertyIcalExportUrl(propertyId: string | undefined) {
  return useQuery({
    queryKey: ['property-ical-export', propertyId],
    queryFn: () => propertyIcalApi.getExportUrl(propertyId!),
    enabled: Boolean(propertyId),
  });
}
