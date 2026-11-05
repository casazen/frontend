import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accessCodeApi } from '@/api/access-code.api';
import type { AccessCodeStatusItem } from '@/types';

const ACCESS_CODES_KEY = ['access-codes'] as const;

/** The server answers at most this many properties per page (`GET api/properties/access-codes`). */
const STATUS_PAGE_SIZE = 100;

/** A stop against a server that never ends its pages; no host has five thousand properties. */
const MAX_STATUS_PAGES = 50;

/** Every property the caller reaches, page after page: a host with more than one page of properties does not lose the rest. */
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
 * For each property the caller reaches: is its lock code set, and when. It never carries a code. The list is read again whenever the
 * page opens (the client's default is not to): the codes are set from more than one screen.
 */
export function useAccessCodeStatus() {
  return useQuery({
    queryKey: [...ACCESS_CODES_KEY, 'status'],
    queryFn: fetchAllStatus,
    refetchOnMount: true,
  });
}

/**
 * Sets or changes the lock code of a property. The code is among the variables of the mutation, so it is not kept: the mutation goes
 * away with the window that sent it (`gcTime: 0`). Saving it reloads the list of states, which is all that comes back.
 */
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
