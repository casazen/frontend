import { useQuery } from '@tanstack/react-query';
import { assetQueryKey, marketingStudioApi } from '@/api/marketing-studio.api';

export function useMarketingAssets(enabled = true) {
  return useQuery({ queryKey: assetQueryKey, queryFn: marketingStudioApi.assets, enabled });
}
