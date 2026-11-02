import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { SupplierPickerSort } from '@/types/service-request';
import { MARKETPLACE_SORT_PARAM, MARKETPLACE_VERIFIED_PARAM } from './marketplace-paths';

/** The orders of a list of suppliers, as the API takes them (`?sort=`): the first is the one a list starts from (the ranking, SP-REL). */
export const SUPPLIER_SORTS: readonly SupplierPickerSort[] = ['recommended', 'name', 'price', 'response'];

export interface SupplierFilters {
  sort: SupplierPickerSort;
  /** «Solo verificati». */
  verifiedOnly: boolean;
  setSort: (sort: SupplierPickerSort) => void;
  setVerifiedOnly: (verifiedOnly: boolean) => void;
  /** How many of the two are not at their start: the number on the button of the filters of a phone. */
  active: number;
}

/**
 * The order and «Solo verificati» of a list of suppliers (a category, a search). They are in the address, so that a list can be
 * shared and Back finds it as it was; what is at its start is not written (the plain address is the plain list), and what is not
 * valid is the start.
 */
export function useSupplierFilters(): SupplierFilters {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(MARKETPLACE_SORT_PARAM);
  const sort = SUPPLIER_SORTS.find((candidate) => candidate === requested) ?? SUPPLIER_SORTS[0];
  const verifiedOnly = searchParams.get(MARKETPLACE_VERIFIED_PARAM) === '1';

  const write = useCallback(
    (name: string, value: string | null) =>
      setSearchParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (value) next.set(name, value);
          else next.delete(name);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  return {
    sort,
    verifiedOnly,
    setSort: (next) => write(MARKETPLACE_SORT_PARAM, next === SUPPLIER_SORTS[0] ? null : next),
    setVerifiedOnly: (next) => write(MARKETPLACE_VERIFIED_PARAM, next ? '1' : null),
    active: (sort === SUPPLIER_SORTS[0] ? 0 : 1) + (verifiedOnly ? 1 : 0),
  };
}
