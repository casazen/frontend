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
  propertyId: z.string().min(1, 'ota.validation.propertyId.required'),
  credentials: otaCredentialsSchema,
  isActive: z.boolean(),
});

export const pricingUpdateSchema = z.object({
  propertyId: z.string().min(1, 'ota.validation.propertyId.required'),
  nightlyRate: z.number().min(0.01, 'ota.validation.nightlyRate.min'),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  platforms: z.array(z.enum(['AIRBNB', 'BOOKING_COM', 'EXPEDIA', 'VRBO', 'TRIPADVISOR', 'AGODA'])).optional(),
});

export type OtaCredentialsFormValues = z.infer<typeof otaCredentialsSchema>;
export type OtaIntegrationFormValues = z.infer<typeof otaIntegrationFormSchema>;
export type PricingUpdateFormValues = z.infer<typeof pricingUpdateSchema>;

/** @deprecated Use getOtaPlatformLabel from @/lib/i18n-labels */
export const OTA_PLATFORM_COLORS: Record<string, string> = {
  AIRBNB: '#FF5A5F',
  BOOKING_COM: '#003580',
  EXPEDIA: '#FFCC00',
  VRBO: '#0066CC',
  TRIPADVISOR: '#00AF87',
  AGODA: '#D4145A',
};

export const OTA_PLATFORM_ICONS: Record<string, string> = {
  AIRBNB: '🏠',
  BOOKING_COM: '🏨',
  EXPEDIA: '✈️',
  VRBO: '🏡',
  TRIPADVISOR: '🦉',
  AGODA: '🌴',
};

export const SYNC_STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PENDING: 'warning',
  IN_PROGRESS: 'default',
  COMPLETED: 'success',
  FAILED: 'destructive',
};
