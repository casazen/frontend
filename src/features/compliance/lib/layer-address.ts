import { isValidDetailId } from '@/lib/detail-address';
import { isStayDate } from '@/lib/stay-dates';

const PROPERTY_ID = /^[A-Za-z0-9_-]{1,64}$/;

interface LayerAddress {
  propertyId: string;
  day?: string;
}

export function layerIdOf(propertyId: string, day?: string | null): string | null {
  if (!PROPERTY_ID.test(propertyId)) return null;
  const id = day && isStayDate(day) ? `${propertyId}:${day}` : propertyId;
  return isValidDetailId(id) ? id : null;
}

export function parseLayerId(id: string): LayerAddress | null {
  const [propertyId, day, ...rest] = id.split(':');
  if (!PROPERTY_ID.test(propertyId) || rest.length > 0) return null;
  if (day === undefined) return { propertyId };
  return isStayDate(day) ? { propertyId, day } : { propertyId };
}
