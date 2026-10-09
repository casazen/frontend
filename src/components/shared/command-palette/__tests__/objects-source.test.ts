import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { objectsSource } from '../sources/objects';
import type { CommandItem } from '../types';
import { makeContext } from './test-context';

const PROPERTY = { id: 'p-lago', name: 'Casa del Lago', city: 'Como', address: 'Via Roma 10', description: 'Vista lago', ownerId: 'o1' };

const BOOKING = {
  id: 'b-1',
  propertyId: 'p-lago',
  propertyName: 'Casa del Lago',
  checkInDate: '2026-11-20',
  checkOutDate: '2026-11-23',
  totalPrice: 450,
  guest: { firstName: 'Mario', lastName: 'Rossi', email: 'mario.rossi@example.com', phone: '+39 333 1234567', country: 'IT' },
};

const GUEST = {
  id: 'g-1',
  firstName: 'Anna',
  lastName: 'Bianchi',
  email: 'anna.bianchi@example.com',
  phoneNumber: '+39 06 5550123',
  city: 'Roma',
  country: 'IT',
};

function cache(setup: (client: QueryClient) => void): QueryClient {
  const client = new QueryClient();
  setup(client);
  return client;
}

const objectsOf = (client: QueryClient | null, options: Omit<Parameters<typeof makeContext>[0] & object, 'queryClient'> = {}) =>
  objectsSource.getItems(makeContext({ ...options, queryClient: client }));

const byId = (items: CommandItem[], id: string) => items.find((entry) => entry.id === id);

describe('the objects the pages loaded (UI-06)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('ObjectsSource_NoQueryClient_FindsNothing', () => {
    expect(objectsOf(null)).toEqual([]);
  });

  it('ObjectsSource_EmptyCache_FindsNothing', () => {
    expect(objectsOf(new QueryClient())).toEqual([]);
  });

  it('ObjectsSource_PropertiesInTheListAndInTheirOwnEntry_AreFoundOnceEach', () => {
    const client = cache((c) => {
      c.setQueryData(['properties', undefined], [PROPERTY, { ...PROPERTY, id: 'p-mare', name: 'Villa Mare', city: 'Roma' }]);
      c.setQueryData(['properties', 'p-lago'], PROPERTY);
    });

    const items = objectsOf(client);

    expect(items.filter((entry) => entry.kind === 'property').map((entry) => entry.id)).toEqual(['property:p-lago', 'property:p-mare']);
    expect(byId(items, 'property:p-lago')).toMatchObject({
      label: 'Casa del Lago',
      subtitle: 'Como',
      to: '/app/short-rent/properties/p-lago',
      area: 'short-rent',
    });
  });

  it('ObjectsSource_AnswersThatAreNotPropertiesBelowTheSameRoot_AreLeftOut', () => {
    const client = cache((c) => {
      c.setQueryData(['properties', 'p-lago', 'documents'], [{ id: 'd1', name: 'APE.pdf', documentType: 'Ape' }]);
      c.setQueryData(['properties', 'cancellation-policies'], [{ id: 'flex', name: 'Flessibile' }]);
      c.setQueryData(['properties', 'p-lago', 'detail'], { id: 'p-lago', name: 'Casa del Lago', cinStatus: 'Missing' });
      c.setQueryData(['properties', 'broken'], 'not an object');
      c.setQueryData(['properties', 'nothing'], null);
    });

    expect(objectsOf(client)).toEqual([]);
  });

  it('ObjectsSource_BookingsInAPageAndInAList_AreFoundWithTheGuestAndThePropertyAndTheDates', () => {
    const client = cache((c) => {
      c.setQueryData(['bookings', { page: 1 }], { items: [BOOKING], totalCount: 1, page: 1, pageSize: 10 });
      c.setQueryData(['bookings', { propertyId: 'p-lago' }], [{ ...BOOKING, id: 'b-2', guest: { ...BOOKING.guest, firstName: 'Luisa' } }]);
      c.setQueryData(['bookings', 'approval-requests'], [{ ...BOOKING, id: 'b-3', guest: { ...BOOKING.guest, firstName: 'Paolo' } }]);
    });

    const items = objectsOf(client);

    expect(items.filter((entry) => entry.kind === 'booking').map((entry) => entry.label).sort()).toEqual(['Luisa Rossi', 'Mario Rossi', 'Paolo Rossi']);
    expect(byId(items, 'booking:b-1')).toMatchObject({
      label: 'Mario Rossi',
      subtitle: 'Casa del Lago · 20 nov – 23 nov',
      to: '/app/short-rent/bookings/b-1',
      area: 'short-rent',
    });
  });

  it('ObjectsSource_Dates_FollowTheLanguage', () => {
    const client = cache((c) => c.setQueryData(['bookings', { page: 1 }], { items: [BOOKING] }));

    const items = objectsOf(client, { locale: 'en' });

    expect(byId(items, 'booking:b-1')?.subtitle).toBe('Casa del Lago · Nov 20 – Nov 23');
  });

  it('ObjectsSource_BookingWithoutGuestNameOrDates_StillHasALabelAndNoBrokenSubtitle', () => {
    const client = cache((c) =>
      c.setQueryData(['bookings', { page: 1 }], {
        items: [{ ...BOOKING, guest: { firstName: '', lastName: '' }, checkInDate: 'soon', propertyName: '' }],
      }),
    );

    const [entry] = objectsOf(client);

    expect(entry.label).toBe('Prenotazione');
    expect(entry.subtitle).toBeUndefined();
  });

  it('ObjectsSource_Guests_AreFoundByNameAndNothingElse', () => {
    const client = cache((c) => {
      c.setQueryData(['guests', { search: '', page: 1 }], { items: [GUEST], totalCount: 1, page: 1, pageSize: 20 });
      c.setQueryData(['guests', 'g-2'], { ...GUEST, id: 'g-2', firstName: 'Luigi', lastName: 'Verdi', documentNumberMasked: '*****123', notes: 'allergico' });
    });

    const items = objectsOf(client);

    expect(items.filter((entry) => entry.kind === 'guest').map((entry) => entry.label)).toEqual(['Anna Bianchi', 'Luigi Verdi']);
    expect(byId(items, 'guest:g-1')).toMatchObject({ to: '/app/short-rent/guests/g-1', area: 'short-rent' });
    expect(byId(items, 'guest:g-1')?.subtitle).toBeUndefined();
  });

  it('ObjectsSource_Everything_SaysNoEmailNoPhoneNoAddressNoDocumentNoAmountAnywhere', () => {
    const client = cache((c) => {
      c.setQueryData(['properties', undefined], [PROPERTY]);
      c.setQueryData(['bookings', { page: 1 }], { items: [BOOKING] });
      c.setQueryData(['guests', { search: '', page: 1 }], { items: [GUEST] });
      c.setQueryData(['guests', 'g-2'], { ...GUEST, id: 'g-2', documentNumberMasked: '*****123', notes: 'allergico alle arachidi' });
    });

    const everything = JSON.stringify(objectsOf(client).map(({ id, kind, label, subtitle, keywords, to }) => ({ id, kind, label, subtitle, keywords, to })));

    for (const secret of ['@example.com', '+39', '333', '5550123', 'Via Roma', '*****123', 'allergico', '450', 'Vista lago']) {
      expect(everything, secret).not.toContain(secret);
    }
    // And nothing that is not shown is used to find them.
    for (const entry of objectsOf(client)) expect(entry.keywords).toBeUndefined();
  });

  it('ObjectsSource_WithoutThePermissionToReadBookings_NeitherBookingsNorGuestsAreFound', () => {
    const client = cache((c) => {
      c.setQueryData(['properties', undefined], [PROPERTY]);
      c.setQueryData(['bookings', { page: 1 }], { items: [BOOKING] });
      c.setQueryData(['guests', { search: '', page: 1 }], { items: [GUEST] });
    });

    const items = objectsOf(client, { hasPermission: (_area, permission) => permission !== 'booking.read' });

    expect(items.map((entry) => entry.kind)).toEqual(['property']);
  });

  it('ObjectsSource_WithoutThePermissionToReadProperties_NoPropertiesAreFound', () => {
    const client = cache((c) => {
      c.setQueryData(['properties', undefined], [PROPERTY]);
      c.setQueryData(['bookings', { page: 1 }], { items: [BOOKING] });
    });

    const items = objectsOf(client, { hasPermission: (_area, permission) => permission !== 'property.read' });

    expect(items.map((entry) => entry.kind)).toEqual(['booking']);
  });

  it('ObjectsSource_LandlordOfLongRentals_FindsPropertiesOfItsAreaAndNoBookings', () => {
    const client = cache((c) => {
      c.setQueryData(['properties', undefined], [PROPERTY]);
      c.setQueryData(['bookings', { page: 1 }], { items: [BOOKING] });
    });

    const items = objectsOf(client, { areas: ['long-rent'] });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'property', to: '/app/long-rent/properties/p-lago', area: 'long-rent' });
  });

  it('ObjectsSource_UserOfBothAreas_GoesToThePropertyPageOfTheAreaItIsIn', () => {
    const client = cache((c) => c.setQueryData(['properties', undefined], [PROPERTY]));

    const fromShort = objectsOf(client, { areas: ['short-rent', 'long-rent'], activeArea: 'short-rent' });
    const fromLong = objectsOf(client, { areas: ['short-rent', 'long-rent'], activeArea: 'long-rent' });

    expect(fromShort[0].to).toBe('/app/short-rent/properties/p-lago');
    expect(fromLong[0].to).toBe('/app/long-rent/properties/p-lago');
  });

  it('ObjectsSource_UserInAnAreaWithoutPropertyPages_GoesToTheOneThatHasThem', () => {
    const client = cache((c) => c.setQueryData(['properties', undefined], [PROPERTY]));

    const items = objectsOf(client, { areas: ['admin', 'long-rent'], activeArea: 'admin' });

    expect(items[0].to).toBe('/app/long-rent/properties/p-lago');
  });

  it('ObjectsSource_SupplierAndStaff_FindNoObjectsOfTheHosts', () => {
    const client = cache((c) => {
      c.setQueryData(['properties', undefined], [PROPERTY]);
      c.setQueryData(['bookings', { page: 1 }], { items: [BOOKING] });
      c.setQueryData(['guests', { search: '', page: 1 }], { items: [GUEST] });
    });

    expect(objectsOf(client, { areas: ['supplier', 'admin'] })).toEqual([]);
  });

  it('ObjectsSource_ARecordInTwoAnswers_ComesFromTheNewerOne', () => {
    const client = new QueryClient();
    client.setQueryData(['properties', 'p-lago'], { ...PROPERTY, name: 'Casa del Lago (vecchio nome)' }, { updatedAt: 1_000 });
    client.setQueryData(['properties', undefined], [{ ...PROPERTY, name: 'Casa sul Lago' }], { updatedAt: 2_000 });

    const items = objectsOf(client);

    expect(items).toHaveLength(1);
    expect(items[0].label).toBe('Casa sul Lago');
  });

  it('ObjectsSource_AQueryThatHasNoAnswerYet_IsLeftOut', () => {
    const client = new QueryClient();
    client.getQueryCache().build(client, { queryKey: ['properties', undefined] });

    expect(objectsOf(client)).toEqual([]);
  });

  it('ObjectsSource_AnIdWithASlash_CannotLeaveThePath', () => {
    const client = cache((c) => c.setQueryData(['properties', undefined], [{ ...PROPERTY, id: 'a/b?c' }]));

    expect(objectsOf(client)[0].to).toBe('/app/short-rent/properties/a%2Fb%3Fc');
  });

  it('ObjectsSource_Reading_AsksTheServerForNothing', () => {
    const client = cache((c) => c.setQueryData(['properties', undefined], [PROPERTY]));
    const fetchQuery = vi.spyOn(client, 'fetchQuery');

    objectsOf(client);

    expect(fetch).not.toHaveBeenCalled();
    expect(fetchQuery).not.toHaveBeenCalled();
  });
});
