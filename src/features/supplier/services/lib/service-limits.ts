/**
 * The limits of the catalog (`SupplierServiceCatalogLimits`, backend SP-02) as the forms use them: the forms check them before
 * asking, the API checks them again (422 `supplier_service_invalid` with the fields at fault). The messages that name a limit
 * (`supplier.services.errors.nameTooLong`, `amountRange`, …) say the number in their text: a limit that changes changes there too.
 */
export const SERVICE_LIMITS = {
  /** Services a supplier can have; the list answers with its own `limit`, this is only what a form shows before it loads. */
  maxServices: 30,
  nameMaxLength: 60,
  summaryMaxLength: 200,
  descriptionMaxLength: 2000,
  /** Highest price or supplement, in cents (100,000 €). The lowest is 1 cent. */
  maxAmountCents: 10_000_000,
  minDurationMinutes: 5,
  maxDurationMinutes: 24 * 60,
  maxNoticeHours: 30 * 24,
  maxSupplements: 10,
  supplementLabelMaxLength: 80,
  supplementCodeMaxLength: 40,
  maxSupplementQuantity: 99,
  /** Entries of the "included" list and of the "not included" list, each. */
  maxListItems: 10,
  listItemMaxLength: 100,
  maxPhotos: 6,
  maxPhotoBytes: 10 * 1024 * 1024,
} as const;

/** What the upload accepts: checked on the content by the API, so the extension is only a first filter. */
export const SERVICE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** The lengths of a typical working session, in minutes: what the select of the duration offers (a longer or odd one is added when a service has it). */
export const DURATION_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480] as const;

/** The notice a service can ask for, in hours (`null` is the notice of the availability rules). */
export const NOTICE_CHOICES = [null, 0, 2, 4, 12, 24, 48, 72, 168] as const;
