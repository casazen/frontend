import { useEffect, useRef } from 'react';
import { useFormContext } from 'react-hook-form';
import type { Property } from '@/types';
import type { LicensedRequestValues } from '../licensed-request-model';

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
