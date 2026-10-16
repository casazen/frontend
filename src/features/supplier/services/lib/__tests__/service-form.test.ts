import { describe, expect, it } from 'vitest';
import type { SupplierService } from '@/types/supplier-services';
import {
  bodyFromService,
  bookingStepSchema,
  emptyServiceForm,
  priceInputOf,
  priceStepSchema,
  serviceFormResolver,
  serviceStepSchema,
  serviceToForm,
  splitLines,
  toServiceBody,
  type ServiceFormValues,
} from '../service-form';

const ERR = 'supplier.services.errors.';

function form(overrides: Partial<ServiceFormValues> = {}): ServiceFormValues {
  return { ...emptyServiceForm(), name: 'Pulizia cambio ospiti', category: 'cleaning', amount: '45', ...overrides };
}

/** The problems a schema finds, as `path: message`. */
function problems(schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } } }, values: unknown): string[] {
  const result = schema.safeParse(values);
  return result.success ? [] : (result.error?.issues ?? []).map((issue) => `${issue.path.join('.')}: ${issue.message}`);
}

function service(overrides: Partial<SupplierService> = {}): SupplierService {
  return {
    id: '6f1c9a52-1111-4222-8333-944455556666',
    slug: 'pulizia-cambio-ospiti',
    name: 'Pulizia cambio ospiti',
    category: 'cleaning',
    summary: 'La casa pronta per il prossimo ospite.',
    description: 'Cosa faccio.',
    priceFromCents: 4550,
    priceUnit: 'PerJob',
    pricesIncludeVat: true,
    requiresQuote: false,
    durationMinutes: 150,
    minNoticeHours: 24,
    weekdays: ['Monday', 'Tuesday', 'Friday'],
    supplements: [
      { code: 'bagno-in-piu', label: 'Bagno in più', amountCents: 1000, per: 'bathroom', max: 3 },
      { code: 'oltre-60-mq', label: 'Oltre 60 m²', amountCents: 1500, per: 'sqm30', max: null },
    ],
    included: ['Pulizia completa', 'Cambio biancheria'],
    excluded: ['Vetri esterni'],
    photoUrls: ['https://cdn.example/a.jpg', 'https://cdn.example/b.jpg'],
    status: 'Active',
    sortOrder: 0,
    publishable: true,
    missingForPublication: [],
    createdAt: '2026-10-10T08:00:00Z',
    updatedAt: '2026-10-12T08:00:00Z',
    version: 7,
    ...overrides,
  };
}

describe('splitLines', () => {
  it('SplitLines_BlankAndRepeatedLines_AreDropped', () => {
    expect(splitLines('  Pulizia \r\n\r\npulizia\nCambio biancheria\n   \nCAMBIO BIANCHERIA')).toEqual(['Pulizia', 'Cambio biancheria']);
  });

  it('SplitLines_Empty_IsAnEmptyList', () => {
    expect(splitLines('')).toEqual([]);
    expect(splitLines('\n \n')).toEqual([]);
  });
});

describe('toServiceBody', () => {
  it('ToServiceBody_FixedPricePerJob_SendsTheCentsTheUnitAndNoQuote', () => {
    expect(toServiceBody(form({ amount: '45,50', pricesIncludeVat: true, summary: ' Una riga ', description: '' }))).toEqual({
      name: 'Pulizia cambio ospiti',
      category: 'cleaning',
      summary: 'Una riga',
      description: null,
      priceFromCents: 4550,
      priceUnit: 'PerJob',
      pricesIncludeVat: true,
      requiresQuote: false,
      durationMinutes: 120,
      minNoticeHours: null,
      weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      supplements: [],
      included: [],
      excluded: [],
    });
  });

  it.each([
    ['PerSet', 'PerSet'],
    ['PerSquareMeter', 'PerSquareMeter'],
  ] as const)('ToServiceBody_FixedPrice%s_SendsThatUnit', (fixedUnit, priceUnit) => {
    expect(toServiceBody(form({ fixedUnit })).priceUnit).toBe(priceUnit);
  });

  it('ToServiceBody_HourlyPrice_IsPerHourWhateverFixedUnitWasChosenBefore', () => {
    const body = toServiceBody(form({ priceMode: 'hourly', fixedUnit: 'PerSet', amount: '18' }));
    expect(body.priceUnit).toBe('PerHour');
    expect(body.priceFromCents).toBe(1800);
    expect(body.requiresQuote).toBe(false);
  });

  it('ToServiceBody_OnQuote_HasNoPriceAndTheDefaultUnit', () => {
    const body = toServiceBody(form({ priceMode: 'quote', amount: '99', fixedUnit: 'PerSquareMeter' }));
    expect(body.requiresQuote).toBe(true);
    expect(body.priceFromCents).toBeNull();
    expect(body.priceUnit).toBe('PerJob');
  });

  it('ToServiceBody_AmountNotWrittenYet_IsNullForADraft', () => {
    expect(toServiceBody(form({ amount: '' })).priceFromCents).toBeNull();
  });

  it('ToServiceBody_Weekdays_GoInTheOrderOfTheWeek', () => {
    expect(toServiceBody(form({ weekdays: ['Friday', 'Monday', 'Wednesday'] })).weekdays).toEqual(['Monday', 'Wednesday', 'Friday']);
  });

  it('ToServiceBody_ListsOneEntryPerLine_WithoutBlanksOrRepeats', () => {
    const body = toServiceBody(form({ included: 'Pulizia\n\nCambio biancheria\npulizia', excluded: 'Vetri esterni' }));
    expect(body.included).toEqual(['Pulizia', 'Cambio biancheria']);
    expect(body.excluded).toEqual(['Vetri esterni']);
  });

  it('ToServiceBody_Supplements_AreCentsWithACodeForEachNewOneAndTheOldCodeKept', () => {
    const body = toServiceBody(
      form({
        supplements: [
          { code: '', label: 'Bagno in più', amount: '10', per: 'bathroom', max: '3' },
          { code: 'oltre-60-mq', label: 'Superficie grande (rinominato)', amount: '15,50', per: 'sqm30', max: '' },
          { code: '', label: 'Bagno in più', amount: '8', per: 'flat', max: '5' },
          { code: '', label: 'Là più è già così!', amount: '1', per: 'hour', max: '2' },
        ],
      }),
    );
    expect(body.supplements).toEqual([
      { code: 'bagno-in-piu', label: 'Bagno in più', amountCents: 1000, per: 'bathroom', max: 3 },
      // A supplement that was already saved keeps its code, whatever its label became.
      { code: 'oltre-60-mq', label: 'Superficie grande (rinominato)', amountCents: 1550, per: 'sqm30', max: null },
      // The same label twice: the second gets a number. A flat amount has no quantity to limit, so no maximum.
      { code: 'bagno-in-piu-2', label: 'Bagno in più', amountCents: 800, per: 'flat', max: null },
      { code: 'la-piu-e-gia-cosi', label: 'Là più è già così!', amountCents: 100, per: 'hour', max: 2 },
    ]);
  });

  it('ToServiceBody_SupplementWithoutALetter_GetsTheDefaultCode', () => {
    const body = toServiceBody(form({ supplements: [{ code: '', label: '???', amount: '1', per: 'flat', max: '' }] }));
    expect(body.supplements[0]?.code).toBe('supplemento');
  });

  it('ToServiceBody_NewCodeNeverTakesTheCodeOfALaterSupplement', () => {
    const body = toServiceBody(
      form({
        supplements: [
          { code: '', label: 'Bagno', amount: '1', per: 'flat', max: '' },
          { code: 'bagno', label: 'Un altro', amount: '1', per: 'flat', max: '' },
        ],
      }),
    );
    expect(body.supplements.map((s) => s.code)).toEqual(['bagno-2', 'bagno']);
  });

  it('ToServiceBody_LongLabel_KeepsTheCodeWithinTheLimitEvenWithANumber', () => {
    const label = 'a'.repeat(40);
    const body = toServiceBody(
      form({
        supplements: [
          { code: '', label, amount: '1', per: 'flat', max: '' },
          { code: '', label, amount: '1', per: 'flat', max: '' },
        ],
      }),
    );
    expect(body.supplements.map((s) => s.code.length)).toEqual([40, 40]);
    expect(new Set(body.supplements.map((s) => s.code)).size).toBe(2);
  });
});

describe('serviceToForm and bodyFromService', () => {
  it('ServiceToForm_ThenToServiceBody_ReturnsWhatTheServiceHad', () => {
    const saved = service();
    const body = toServiceBody(serviceToForm(saved, ','));
    expect(body).toEqual({
      name: saved.name,
      category: saved.category,
      summary: saved.summary,
      description: saved.description,
      priceFromCents: 4550,
      priceUnit: 'PerJob',
      pricesIncludeVat: true,
      requiresQuote: false,
      durationMinutes: 150,
      minNoticeHours: 24,
      weekdays: ['Monday', 'Tuesday', 'Friday'],
      supplements: saved.supplements,
      included: saved.included,
      excluded: saved.excluded,
    });
  });

  it('ServiceToForm_Amounts_AreWrittenWithTheDecimalPointOfTheLanguage', () => {
    expect(serviceToForm(service(), ',').amount).toBe('45,50');
    expect(serviceToForm(service(), '.').amount).toBe('45.50');
    expect(serviceToForm(service(), ',').supplements[1]?.amount).toBe('15');
    expect(serviceToForm(service(), ',').supplements[0]?.max).toBe('3');
    expect(serviceToForm(service(), ',').supplements[1]?.max).toBe('');
  });

  it.each([
    [{ requiresQuote: true, priceFromCents: null }, 'quote'],
    // A service that asks for a quote is "on quote" in the form, whatever else it carries.
    [{ requiresQuote: true, priceFromCents: 5000, priceUnit: 'PerHour' as const }, 'quote'],
    [{ priceUnit: 'PerHour' as const }, 'hourly'],
    [{ priceUnit: 'PerSet' as const }, 'fixed'],
  ])('ServiceToForm_PriceMode_%j_Is%s', (overrides, mode) => {
    expect(serviceToForm(service(overrides), ',').priceMode).toBe(mode);
  });

  it('ServiceToForm_QuoteOrHourly_KeepsAFixedUnitTheFormCanShow', () => {
    expect(serviceToForm(service({ priceUnit: 'PerHour' }), ',').fixedUnit).toBe('PerJob');
    expect(serviceToForm(service({ priceUnit: 'PerSquareMeter' }), ',').fixedUnit).toBe('PerSquareMeter');
  });

  it('ServiceToForm_OnQuote_HasNoAmount', () => {
    expect(serviceToForm(service({ requiresQuote: true, priceFromCents: 5000 }), ',').amount).toBe('');
  });

  it('ServiceToForm_DraftWithNothingYet_HasEmptyTextsAndNoDuration', () => {
    const draft = service({ summary: null, description: null, priceFromCents: null, durationMinutes: null, minNoticeHours: null, supplements: [], included: [], excluded: [], status: 'Draft' });
    const values = serviceToForm(draft, ',');
    expect(values).toMatchObject({ summary: '', description: '', amount: '', durationMinutes: null, minNoticeHours: null, included: '', excluded: '' });
  });

  it('BodyFromService_WithPhotos_SendsTheServiceAsSavedAndTheNewOrderOfPhotos', () => {
    const saved = service();
    const body = bodyFromService(saved, ['https://cdn.example/b.jpg', 'https://cdn.example/a.jpg']);
    expect(body.photoUrls).toEqual(['https://cdn.example/b.jpg', 'https://cdn.example/a.jpg']);
    expect(body).toMatchObject({ name: saved.name, priceFromCents: 4550, durationMinutes: 150, weekdays: saved.weekdays, included: saved.included });
    expect(body.supplements[1]).toEqual({ code: 'oltre-60-mq', label: 'Oltre 60 m²', amountCents: 1500, per: 'sqm30', max: null });
  });

  it('BodyFromService_NoPhotosLeft_SendsAnEmptyListNotNull', () => {
    expect(bodyFromService(service(), []).photoUrls).toEqual([]);
  });
});

describe('priceInputOf', () => {
  it('PriceInputOf_TheThreeWays_MatchWhatTheApiHolds', () => {
    expect(priceInputOf({ priceMode: 'fixed', fixedUnit: 'PerSet', amount: '12' })).toEqual({ requiresQuote: false, priceFromCents: 1200, priceUnit: 'PerSet' });
    expect(priceInputOf({ priceMode: 'hourly', fixedUnit: 'PerSet', amount: '12' })).toEqual({ requiresQuote: false, priceFromCents: 1200, priceUnit: 'PerHour' });
    expect(priceInputOf({ priceMode: 'quote', fixedUnit: 'PerSet', amount: '12' })).toEqual({ requiresQuote: true, priceFromCents: null, priceUnit: 'PerJob' });
  });
});

describe('the rules of the first step', () => {
  it('ServiceStep_NameAndCategory_AreAsked', () => {
    expect(problems(serviceStepSchema, form({ name: '   ', category: '' }))).toEqual([`name: ${ERR}nameRequired`, `category: ${ERR}categoryRequired`]);
  });

  it('ServiceStep_LimitsOfTheApi_AreChecked', () => {
    const tooLong = form({ name: 'x'.repeat(61), summary: 'x'.repeat(201), description: 'x'.repeat(2001) });
    expect(problems(serviceStepSchema, tooLong)).toEqual([`name: ${ERR}nameTooLong`, `summary: ${ERR}summaryTooLong`, `description: ${ERR}descriptionTooLong`]);
    expect(problems(serviceStepSchema, form({ name: 'x'.repeat(60), summary: 'x'.repeat(200), description: 'x'.repeat(2000) }))).toEqual([]);
  });

  it('ServiceStep_Lists_AreLimitedByEntriesAndByLength', () => {
    const eleven = Array.from({ length: 11 }, (_, i) => `voce ${i}`).join('\n');
    expect(problems(serviceStepSchema, form({ included: eleven }))).toEqual([`included: ${ERR}listTooMany`]);
    expect(problems(serviceStepSchema, form({ excluded: 'x'.repeat(101) }))).toEqual([`excluded: ${ERR}listItemTooLong`]);
    // Blank and repeated lines do not count, as for the API.
    const ten = [...Array.from({ length: 10 }, (_, i) => `voce ${i}`), '', 'VOCE 1'].join('\n');
    expect(problems(serviceStepSchema, form({ included: ten }))).toEqual([]);
  });
});

describe('the rules of the second step', () => {
  it('PriceStep_FixedAndHourly_NeedAnAmount', () => {
    expect(problems(priceStepSchema, form({ amount: '' }))).toEqual([`amount: ${ERR}amountRequired`]);
    expect(problems(priceStepSchema, form({ priceMode: 'hourly', amount: ' ' }))).toEqual([`amount: ${ERR}amountRequired`]);
  });

  it('PriceStep_OnQuote_NeedsNoAmount', () => {
    expect(problems(priceStepSchema, form({ priceMode: 'quote', amount: '' }))).toEqual([]);
  });

  it('PriceStep_AmountThatIsNotAnAmountOrOutOfRange_IsRefused', () => {
    expect(problems(priceStepSchema, form({ amount: 'abc' }))).toEqual([`amount: ${ERR}amountInvalid`]);
    expect(problems(priceStepSchema, form({ amount: '0' }))).toEqual([`amount: ${ERR}amountRange`]);
    expect(problems(priceStepSchema, form({ amount: '100000,01' }))).toEqual([`amount: ${ERR}amountRange`]);
    expect(problems(priceStepSchema, form({ amount: '100000' }))).toEqual([]);
    expect(problems(priceStepSchema, form({ amount: '0,01' }))).toEqual([]);
  });

  it('PriceStep_Supplements_AreCheckedOneByOneWithTheirPath', () => {
    const supplements = [
      { code: '', label: 'Bagno in più', amount: '10', per: 'bathroom' as const, max: '3' },
      { code: '', label: '   ', amount: '', per: 'flat' as const, max: '' },
      { code: '', label: 'Ore', amount: '5', per: 'hour' as const, max: '100' },
      { code: '', label: 'Set', amount: 'x', per: 'set' as const, max: '0' },
    ];
    expect(problems(priceStepSchema, form({ supplements }))).toEqual([
      `supplements.1.label: ${ERR}supplementLabelRequired`,
      `supplements.1.amount: ${ERR}supplementAmountRequired`,
      `supplements.2.max: ${ERR}supplementMaxInvalid`,
      `supplements.3.amount: ${ERR}amountInvalid`,
      `supplements.3.max: ${ERR}supplementMaxInvalid`,
    ]);
  });

  it('PriceStep_FlatSupplement_HasNoQuantityToCheck', () => {
    const supplements = [{ code: '', label: 'Una tantum', amount: '10', per: 'flat' as const, max: 'molti' }];
    expect(problems(priceStepSchema, form({ supplements }))).toEqual([]);
  });

  it('PriceStep_MoreThanTenSupplements_AreRefused', () => {
    const supplements = Array.from({ length: 11 }, (_, i) => ({ code: '', label: `Supplemento ${i}`, amount: '1', per: 'flat' as const, max: '' }));
    expect(problems(priceStepSchema, form({ supplements }))).toEqual([`supplements: ${ERR}supplementsTooMany`]);
    expect(problems(priceStepSchema, form({ supplements: supplements.slice(0, 10) }))).toEqual([]);
  });
});

describe('the rules of the third step', () => {
  it('BookingStep_DurationNotChosenYet_IsAsked', () => {
    expect(problems(bookingStepSchema, form({ durationMinutes: null }))).toEqual([`durationMinutes: ${ERR}durationRequired`]);
  });

  it('BookingStep_AtLeastADay_IsAsked', () => {
    expect(problems(bookingStepSchema, form({ weekdays: [] }))).toEqual([`weekdays: ${ERR}weekdaysRequired`]);
  });

  it('BookingStep_DefaultsAndTheOddValuesOfAnotherClient_AreAccepted', () => {
    expect(problems(bookingStepSchema, form())).toEqual([]);
    expect(problems(bookingStepSchema, form({ durationMinutes: 5, minNoticeHours: 0 }))).toEqual([]);
    expect(problems(bookingStepSchema, form({ durationMinutes: 1440, minNoticeHours: 720 }))).toEqual([]);
    expect(problems(bookingStepSchema, form({ durationMinutes: 4 }))).toEqual([`durationMinutes: ${ERR}durationRequired`]);
    expect(problems(bookingStepSchema, form({ durationMinutes: 1441 }))).toEqual([`durationMinutes: ${ERR}durationRequired`]);
  });
});

describe('the rules of the whole form', () => {
  /** What the page of a service asks of its form: the errors by field, as react-hook-form reads them. */
  async function errorsOf(values: ServiceFormValues) {
    const result = await serviceFormResolver(values, undefined, { fields: {}, names: [], criteriaMode: 'firstError', shouldUseNativeValidation: false });
    return result.errors as Record<string, { message?: string } | Record<string, unknown>>;
  }

  it('ServiceForm_AValidService_HasNoProblem', async () => {
    expect(await errorsOf(serviceToForm(service(), ','))).toEqual({});
  });

  it('ServiceForm_ProblemsOfEveryStep_ComeTogether', async () => {
    const errors = await errorsOf(form({ name: '', amount: '', durationMinutes: null }));
    expect(Object.keys(errors).sort()).toEqual(['amount', 'durationMinutes', 'name']);
    expect(errors.name).toMatchObject({ message: `${ERR}nameRequired` });
    expect(errors.amount).toMatchObject({ message: `${ERR}amountRequired` });
    expect(errors.durationMinutes).toMatchObject({ message: `${ERR}durationRequired` });
  });

  it('ServiceForm_OnQuote_NeedsNoAmountEither', async () => {
    expect(await errorsOf(form({ priceMode: 'quote', amount: '' }))).toEqual({});
  });

  it('ServiceForm_ASupplementOfThePriceStep_IsReportedUnderItsPosition', async () => {
    const supplements = [{ code: '', label: '', amount: '5', per: 'flat' as const, max: '' }];
    const errors = await errorsOf(form({ supplements }));
    expect(errors.supplements).toBeDefined();
    expect(JSON.stringify(errors.supplements)).toContain(`${ERR}supplementLabelRequired`);
  });
});
