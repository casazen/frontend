import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSupplierSettings, saveSupplierSettings } from '@/api/supplier-settings.api';

const SETTINGS_KEY = ['supplier', 'settings'] as const;

export function useSupplierSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: fetchSupplierSettings,
    refetchOnMount: 'always',
  });
}

export function useSaveSupplierSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSupplierSettings,
    onSuccess: (saved) => queryClient.setQueryData(SETTINGS_KEY, saved),
  });
}
