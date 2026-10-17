import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSupplierSettings, saveSupplierSettings } from '@/api/supplier-settings.api';

const SETTINGS_KEY = ['supplier', 'settings'] as const;

/** The settings of the supplier, read again every time the page opens (the shared client does not read again on mount). */
export function useSupplierSettings() {
  return useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: fetchSupplierSettings,
    refetchOnMount: 'always',
  });
}

/** Saves the settings; what the server answers replaces what the page holds. */
export function useSaveSupplierSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveSupplierSettings,
    onSuccess: (saved) => queryClient.setQueryData(SETTINGS_KEY, saved),
  });
}
