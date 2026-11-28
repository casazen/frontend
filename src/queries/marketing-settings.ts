import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { marketingStudioApi, type MarketingSettings } from '@/api/marketing-studio.api';

const SETTINGS_KEY = ['marketing-settings'];

export function useMarketingSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: marketingStudioApi.settings });
}

export function useSaveMarketingSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (value: MarketingSettings) => marketingStudioApi.saveSettings(value),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: SETTINGS_KEY });
      await client.invalidateQueries({ queryKey: ['segments'] });
    },
  });
}
