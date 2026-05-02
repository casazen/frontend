export interface Property {
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;  // ✅ Fixed: was zipCode
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;  // ✅ Fixed: was pricePerNight
  cleaningFee: number;  // ✅ Added - missing from backend
  damageDeposit: number;  // ✅ Added - missing from backend
  currency: string;
  amenities: string[];
  photoUrls: string[];  // ✅ Fixed: was images
  houseRules: string;  // ✅ Added - missing from backend
  cinCode: string | null;  // ✅ Added - Italian compliance
  timezone: string;  // ✅ Added - missing from backend
  cancellationPolicyId: string | null;  // ✅ Added - missing from backend
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
  postalCode: string;  // ✅ Fixed: was zipCode
  latitude?: number;
  longitude?: number;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  nightlyRate: number;  // ✅ Fixed: was pricePerNight
  currency?: string;
  amenities?: string[];
  photoUrls?: string[];  // ✅ Fixed: was images
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
