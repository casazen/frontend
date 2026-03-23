export interface Property {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  pricePerNight: number;
  currency: string;
  amenities: string[];
  images: string[];
  isActive: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePropertyDto {
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  zipCode: string;
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  pricePerNight: number;
  currency?: string;
  amenities?: string[];
  images?: string[];
  isActive?: boolean;
}

export interface UpdatePropertyDto extends Partial<CreatePropertyDto> {}

export interface PropertySearchParams {
  city?: string;
  minPrice?: number;
  maxPrice?: number;
  minBedrooms?: number;
  maxGuests?: number;
  amenities?: string[];
  page?: number;
  limit?: number;
}
