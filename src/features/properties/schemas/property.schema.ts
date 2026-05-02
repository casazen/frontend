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
});

export type PropertyFormValues = z.infer<typeof propertyFormSchema>;

export const COMMON_AMENITIES = [
  'WiFi',
  'Air Conditioning',
  'Heating',
  'Kitchen',
  'Washer',
  'Dryer',
  'TV',
  'Parking',
  'Pool',
  'Hot Tub',
  'Gym',
  'Elevator',
  'Balcony',
  'Terrace',
  'Garden',
  'BBQ Grill',
  'Fireplace',
  'Pet Friendly',
  'Smoke Detector',
  'First Aid Kit',
  'Fire Extinguisher',
  'Carbon Monoxide Detector',
];
