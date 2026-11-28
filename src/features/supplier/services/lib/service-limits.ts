export const SERVICE_LIMITS = {
  maxServices: 30,
  nameMaxLength: 60,
  summaryMaxLength: 200,
  descriptionMaxLength: 2000,
  maxAmountCents: 10_000_000,
  minDurationMinutes: 5,
  maxDurationMinutes: 24 * 60,
  maxNoticeHours: 30 * 24,
  maxSupplements: 10,
  supplementLabelMaxLength: 80,
  supplementCodeMaxLength: 40,
  maxSupplementQuantity: 99,
  maxListItems: 10,
  listItemMaxLength: 100,
  maxPhotos: 6,
  maxPhotoBytes: 10 * 1024 * 1024,
} as const;

export const SERVICE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const DURATION_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480] as const;

export const NOTICE_CHOICES = [null, 0, 2, 4, 12, 24, 48, 72, 168] as const;
