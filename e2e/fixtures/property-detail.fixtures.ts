import type { PropertyDetailDto } from '../../src/types';

export const PROPERTY_DETAIL_ID = 'prop-detail-e2e-001';

export const propertyDetailFixture: PropertyDetailDto = {
  id: PROPERTY_DETAIL_ID,
  ownerId: 'auth0|owner-e2e',
  name: 'Villa Mare E2E',
  description: 'Appartamento vista mare per test E2E.',
  address: 'Via Lungomare 10',
  city: 'Rimini',
  postalCode: '47921',
  bedrooms: 2,
  bathrooms: 1,
  maxGuests: 4,
  nightlyRate: 120,
  cleaningFee: 40,
  damageDeposit: 200,
  cinCode: 'IT-12345-0123456789',
  cinStatus: 'Valid',
  timezone: 'Europe/Rome',
  amenities: ['WiFi', 'AirConditioning', 'Kitchen'],
  photoUrls: ['https://picsum.photos/seed/casazen/800/400'],
  houseRules: 'No smoking',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  documents: [
    {
      id: 'doc-e2e-001',
      fileName: 'cin-certificato.pdf',
      fileType: 'pdf',
      uploadedAt: '2026-05-01T10:00:00Z',
      downloadUrl: '/uploads/properties/cin-certificato.pdf',
    },
  ],
  otaIntegrations: [
    {
      id: 'ota-e2e-001',
      platform: 'Airbnb',
      syncStatus: 'Success',
      lastSyncAt: '2026-06-04T08:00:00Z',
      isActive: true,
      syncEnabled: true,
    },
  ],
  bookingsSummary: {
    totalBookings: 12,
    upcomingBookings: 3,
    activeBookings: 1,
    nextCheckIn: '2026-06-10T14:00:00Z',
    nextCheckOut: '2026-06-08T10:00:00Z',
  },
  pricingAdapterSummary: {
    isEnabled: true,
    lastAdaptedAt: '2026-06-03T02:00:00Z',
    nextScheduledRunAt: '2026-06-06T02:00:00Z',
  },
};
