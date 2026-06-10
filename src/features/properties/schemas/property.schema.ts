import { z } from 'zod';

export const propertyFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name must be less than 100 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000, 'Description must be less than 1000 characters'),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  country: z.string().min(2, 'Country is required'),
  postalCode: z.string().min(3, 'Postal code is required'),  // ✅ Fixed: was zipCode
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  bedrooms: z.number().int().min(1, 'At least 1 bedroom is required').max(50),
  bathrooms: z.number().min(0.5, 'At least 0.5 bathrooms required').max(20),
  maxGuests: z.number().int().min(1, 'At least 1 guest capacity required').max(100),
  nightlyRate: z.number().min(1, 'Price must be at least 1').max(100000),  // ✅ Fixed: was pricePerNight
  currency: z.string(),
  amenities: z.array(z.string()),
  photoUrls: z.array(z.string()),  // ✅ Fixed: was images
  isActive: z.boolean(),
  cinCode: z
    .string()
    .regex(/^IT-\d{5}-\d{10}$/, 'Formato CIN: IT-XXXXX-XXXXXXXXXX')
    .optional()
    .or(z.literal('')),
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

// Exact C# PropertyAmenity enum names — used as API values
export const COMMON_AMENITIES = [
  'WiFi',
  'AirConditioning',
  'Heating',
  'Kitchen',
  'Washer',
  'Dryer',
  'TV',
  'FreeParking',
  'Pool',
  'HotTub',
  'Gym',
  'Elevator',
  'Balcony',
  'Terrace',
  'Garden',
  'BBQGrill',
  'Fireplace',
  'PetFriendly',
  'SmokeDetector',
  'FirstAidKit',
  'FireExtinguisher',
  'CarbonMonoxideDetector',
];

// Human-readable display labels for UI checkboxes
export const AMENITY_LABELS: Record<string, string> = {
  WiFi: 'WiFi',
  AirConditioning: 'Air Conditioning',
  Heating: 'Heating',
  Kitchen: 'Kitchen',
  Washer: 'Washer',
  Dryer: 'Dryer',
  TV: 'TV',
  FreeParking: 'Parking',
  Pool: 'Pool',
  HotTub: 'Hot Tub',
  Gym: 'Gym',
  Elevator: 'Elevator',
  Balcony: 'Balcony',
  Terrace: 'Terrace',
  Garden: 'Garden',
  BBQGrill: 'BBQ Grill',
  Fireplace: 'Fireplace',
  PetFriendly: 'Pet Friendly',
  SmokeDetector: 'Smoke Detector',
  FirstAidKit: 'First Aid Kit',
  FireExtinguisher: 'Fire Extinguisher',
  CarbonMonoxideDetector: 'Carbon Monoxide Detector',
};
