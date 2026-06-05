import type { Property, PropertyDetailDto } from '../../src/types';

export const NEW_PROPERTY_ID = 'prop-flow-e2e-001';

export const emptyPropertyList: Property[] = [];

export function buildCreatedProperty(overrides?: Partial<Property>): Property {
  return {
    id: NEW_PROPERTY_ID,
    ownerId: 'auth0|demo-owner',
    name: 'Casa E2E Flow',
    description: 'Proprietà creata dal test E2E property flow.',
    address: 'Via Roma 10',
    city: 'Roma',
    country: 'IT',
    postalCode: '00100',
    latitude: 0,
    longitude: 0,
    bedrooms: 2,
    bathrooms: 1,
    maxGuests: 4,
    nightlyRate: 120,
    currency: 'EUR',
    cleaningFee: 0,
    damageDeposit: 0,
    amenities: ['WiFi'],
    photoUrls: [],
    houseRules: '',
    cinCode: null,
    timezone: 'Europe/Rome',
    isActive: true,
    createdAt: '2026-06-05T10:00:00Z',
    updatedAt: '2026-06-05T10:00:00Z',
    ...overrides,
  };
}

export function buildPropertyDetailFromProperty(property: Property): PropertyDetailDto {
  return {
    id: property.id,
    ownerId: property.ownerId,
    name: property.name,
    description: property.description,
    address: property.address,
    city: property.city,
    postalCode: property.postalCode,
    bedrooms: property.bedrooms,
    bathrooms: property.bathrooms,
    maxGuests: property.maxGuests,
    nightlyRate: property.nightlyRate,
    cleaningFee: property.cleaningFee ?? 0,
    damageDeposit: property.damageDeposit ?? 0,
    cinCode: property.cinCode ?? null,
    cinStatus: 'Missing',
    timezone: property.timezone ?? 'Europe/Rome',
    amenities: property.amenities ?? [],
    photoUrls: property.photoUrls ?? [],
    houseRules: property.houseRules ?? '',
    isActive: property.isActive,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
    documents: [],
    otaIntegrations: [],
    bookingsSummary: {
      totalBookings: 0,
      upcomingBookings: 0,
      activeBookings: 0,
      nextCheckIn: null,
      nextCheckOut: null,
    },
    pricingAdapterSummary: {
      isEnabled: false,
      lastAdaptedAt: null,
      nextScheduledRunAt: null,
    },
  };
}
