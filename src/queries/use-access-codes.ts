import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessCodeApi } from '@/api/access-code.api';
import type { AccessCodeStatusItem } from '@/types';

const ACCESS_CODES_KEY = ['access-codes'] as const;

const STATUS_PAGE_SIZE = 100;

const MAX_STATUS_PAGES = 50;

async function fetchAllStatus(): Promise<AccessCodeStatusItem[]> {
  const items: AccessCodeStatusItem[] = [];
  for (let page = 1; page <= MAX_STATUS_PAGES; page += 1) {
    const answer = await accessCodeApi.getStatus({ page, pageSize: STATUS_PAGE_SIZE });
    items.push(...answer.items);
    if (answer.items.length === 0 || items.length >= answer.totalCount) break;
  }
  return items;
}

/**
 * For each property the caller reaches: is its lock code set, and when. It never carries a code. The list is read again every time the
 * page opens (`'always'`: the client's default is not to, and what it has stays fresh for five minutes): the codes are set from more
 * than one screen.
 */
export function useAccessCodeStatus() {
  return useQuery({
    queryKey: [...ACCESS_CODES_KEY, 'status'],
    queryFn: fetchAllStatus,
    refetchOnMount: 'always',
  });
}

export function useSetAccessCode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ propertyId, code }: { propertyId: string; code: string }) => accessCodeApi.setCode(propertyId, { code }),
    gcTime: 0,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ACCESS_CODES_KEY });
    },
  });
}
