import type {
  PricingAdapterConfig,
  PricingHistoryPagedResponse,
  PricingPreviewResponse,
} from '../../src/types';

export const PROPERTY_ID = 'prop-e2e-001';

export const configEnabled: PricingAdapterConfig = {
  propertyId: PROPERTY_ID,
  isEnabled: true,
  adaptationFrequency: 'daily',
  includeSeasonality: true,
  includePublicHolidays: true,
  lastAdaptedAt: '2026-05-10T02:00:00Z',
  nextScheduledRunAt: '2026-05-12T02:00:00Z',
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-10T02:00:00Z',
};

export const configDisabled: PricingAdapterConfig = {
  ...configEnabled,
  isEnabled: false,
  lastAdaptedAt: null,
  nextScheduledRunAt: null,
};

export const historyPage1: PricingHistoryPagedResponse = {
  items: [
    {
      id: 'hist-1',
      propertyId: PROPERTY_ID,
      adaptationDate: '2026-05-10',
      previousPrice: 100,
      newPrice: 130,
      changeReason: 'Weekend peak demand',
      aiConfidence: 0.92,
      otasSynced: 'airbnb,booking',
      syncStatus: 'synced',
      createdAt: '2026-05-10T08:00:00Z',
    },
  ],
  total: 25,
  page: 1,
};

export const historyPage2: PricingHistoryPagedResponse = {
  items: [
    {
      id: 'hist-21',
      propertyId: PROPERTY_ID,
      adaptationDate: '2026-04-20',
      previousPrice: 90,
      newPrice: 95,
      changeReason: 'Low season adjustment',
      aiConfidence: 0.78,
      otasSynced: 'airbnb',
      syncStatus: 'partial',
      createdAt: '2026-04-20T08:00:00Z',
    },
  ],
  total: 25,
  page: 2,
};

export const historyAfterSync: PricingHistoryPagedResponse = {
  items: [
    {
      id: 'hist-new',
      propertyId: PROPERTY_ID,
      adaptationDate: '2026-05-11',
      previousPrice: 130,
      newPrice: 145,
      changeReason: 'Manual sync triggered',
      aiConfidence: 0.88,
      otasSynced: 'airbnb,booking',
      syncStatus: 'synced',
      createdAt: '2026-05-11T10:00:00Z',
    },
    ...historyPage1.items,
  ],
  total: 26,
  page: 1,
};

function buildPreviewDays(count: number): PricingPreviewResponse['prices'] {
  const reasons = ['Weekend uplift', 'Weekday rate', 'Public holiday', 'High demand', 'Low season'];
  return Array.from({ length: count }, (_, index) => {
    const day = 12 + index;
    const date = `2026-05-${String(day).padStart(2, '0')}`;
    const isWeekend = index % 7 === 0 || index % 7 === 6;
    const basePrice = 100;
    const suggestedPrice = isWeekend ? 140 + (index % 3) * 5 : 105 + (index % 4) * 3;
    return {
      date,
      suggestedPrice,
      basePrice,
      reason: reasons[index % reasons.length],
    };
  });
}

export const previewData: PricingPreviewResponse = {
  prices: buildPreviewDays(90),
};

/** Subset used when tests only need the AC20 minimum (≥ 7 rows). */
export const previewDataMinimal: PricingPreviewResponse = {
  prices: buildPreviewDays(7),
};

export const syncResponse = { jobId: 'job-e2e-sync-001' };
