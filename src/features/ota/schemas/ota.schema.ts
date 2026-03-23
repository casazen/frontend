import { z } from 'zod';

export const otaCredentialsSchema = z.object({
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  propertyId: z.string().optional(),
});

export const otaIntegrationFormSchema = z.object({
  platform: z.enum(['AIRBNB', 'BOOKING_COM', 'EXPEDIA', 'VRBO', 'TRIPADVISOR', 'AGODA']),
  propertyId: z.string().min(1, 'Property is required'),
  credentials: otaCredentialsSchema,
  isActive: z.boolean(),
});

export const pricingUpdateSchema = z.object({
  propertyId: z.string().min(1, 'Property is required'),
  pricePerNight: z.number().min(0.01, 'Price must be greater than 0'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  platforms: z.array(z.enum(['AIRBNB', 'BOOKING_COM', 'EXPEDIA', 'VRBO', 'TRIPADVISOR', 'AGODA'])).optional(),
});

export type OtaCredentialsFormValues = z.infer<typeof otaCredentialsSchema>;
export type OtaIntegrationFormValues = z.infer<typeof otaIntegrationFormSchema>;
export type PricingUpdateFormValues = z.infer<typeof pricingUpdateSchema>;

export const OTA_PLATFORM_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  AIRBNB: { label: 'Airbnb', color: '#FF5A5F', icon: '🏠' },
  BOOKING_COM: { label: 'Booking.com', color: '#003580', icon: '🏨' },
  EXPEDIA: { label: 'Expedia', color: '#FFCC00', icon: '✈️' },
  VRBO: { label: 'VRBO', color: '#0066CC', icon: '🏡' },
  TRIPADVISOR: { label: 'TripAdvisor', color: '#00AF87', icon: '🦉' },
  AGODA: { label: 'Agoda', color: '#D4145A', icon: '🌴' },
};

export const SYNC_STATUS_LABELS: Record<string, {
  label: string;
  variant: 'default' | 'success' | 'warning' | 'destructive' | 'secondary'
}> = {
  PENDING: { label: 'Pending', variant: 'warning' },
  IN_PROGRESS: { label: 'In Progress', variant: 'default' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'destructive' },
};
