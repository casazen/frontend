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

export type OtaIntegrationFormValues = z.infer<typeof otaIntegrationFormSchema>;

export const PLATFORM_LOGO = {
  AIRBNB: '/integrations/ota/airbnb.svg',
  BOOKING_COM: '/integrations/ota/booking-com.svg',
  EXPEDIA: '/integrations/ota/expedia.svg',
  VRBO: '/integrations/ota/vrbo.webp',
  TRIPADVISOR: '/integrations/metasearch/tripadvisor.webp',
  AGODA: '/integrations/ota/agoda.svg',
} as const;
