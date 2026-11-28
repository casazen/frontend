import { useQuery } from '@tanstack/react-query';
import { fetchServiceCategories } from '@/api/service-categories.api';

export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: fetchServiceCategories,
    staleTime: Infinity,
  });
}
