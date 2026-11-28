import type { Property } from '@/types';

export interface PropertyOption {
  id: string;
  name: string;
  photoUrl?: string;
}

export function propertyOption(property: Property): PropertyOption {
  const absolute = (property.photoUrls ?? []).find((url) => /^https?:\/\//i.test(url));
  return { id: property.id, name: property.name, photoUrl: property.coverPhotoUrl ?? absolute };
}
