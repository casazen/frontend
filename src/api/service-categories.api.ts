import { ApiClient } from '@/api/client';

interface ServiceCategoriesResponse {
  items: { code: string }[];
}

/**
 * Service category codes (`cleaning`, `maintenance`, ...) from the backend catalog
 * (`GET /api/service-categories`, SU-03): the only values the API accepts for supplier profiles,
 * invites, service requests and the supplier search. Labels come from `serviceRequest.categories.<code>`.
 */
export async function fetchServiceCategories(): Promise<string[]> {
  const data = await ApiClient.get<ServiceCategoriesResponse>('/service-categories');
  return data.items.map((item) => item.code);
}
