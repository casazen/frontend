import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import type { Property } from '@/types';
import type { LicensedRequestValues } from '../licensed-request-model';

/**
 * With one property of the host and none chosen yet, CasaZen chooses it (UX-04: fill in what it knows). Once: the person may choose another. A request names exactly one
 * property, so the first step already knows which license to show when the host has only one.
 */
export function useDefaultProperty(properties: readonly Property[], chosen: string): void {
  const { setValue } = useFormContext<LicensedRequestValues>();
  const done = useRef(false);
  const only = properties.length === 1 && chosen === '' ? properties[0].id : null;

  useEffect(() => {
    if (only === null || done.current) return;
    done.current = true;
    setValue('propertyId', only, { shouldDirty: true });
  }, [only, setValue]);
}
