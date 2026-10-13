import { useQuery } from '@tanstack/react-query';
import { fetchServiceCategories } from '@/api/service-categories.api';

/** The catalog changes only with a backend release: loaded once per session. */
export function useServiceCategories() {
  return useQuery({
    queryKey: ['service-categories'],
    queryFn: fetchServiceCategories,
    staleTime: Infinity,
  });
}
