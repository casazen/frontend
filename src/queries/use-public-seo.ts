import { useMutation, useQuery } from '@tanstack/react-query';
import { PublicSeoApi } from '@/api/public-seo.api';
import type { PublicTouristTaxCalculateRequest } from '@/types/seo.types';

const PUBLIC_SEO_KEY = 'public-seo';

export function useComplianceGuide(region: string, comune: string) {
  return useQuery({
    queryKey: [PUBLIC_SEO_KEY, 'compliance-guide', region, comune],
    queryFn: () => PublicSeoApi.getComplianceGuide(region, comune),
    staleTime: 60 * 60 * 1000,
    retry: false,
    enabled: !!region && !!comune,
  });
}

export function useTouristTaxPage(comune: string) {
  return useQuery({
    queryKey: [PUBLIC_SEO_KEY, 'tourist-tax-page', comune],
    queryFn: () => PublicSeoApi.getTouristTaxPage(comune),
    staleTime: 60 * 60 * 1000,
    retry: false,
    enabled: !!comune,
  });
}

export function useCalculateTouristTax() {
  return useMutation({
    mutationFn: (request: PublicTouristTaxCalculateRequest) =>
      PublicSeoApi.calculateTouristTax(request),
  });
}
