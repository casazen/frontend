import { describe, expect, it, vi } from 'vitest';
import { ROUTE_MANIFEST } from '@/config/route-manifest';
import { actionsSource } from '../sources/actions';
import { openablePage } from '../sources/availability';
import type { CommandItem } from '../types';
import { makeContext } from './test-context';

const actionsOf = (...args: Parameters<typeof makeContext>) => actionsSource.getItems(makeContext(...args));
const byId = (items: CommandItem[], id: string) => items.find((entry) => entry.id === id);

describe('the actions of the palette (UI-06)', () => {
  it('ActionsSource_OwnerOfShortRentals_StartsABookingAPropertyAndAPayment', () => {
    const items = actionsOf({ areas: ['short-rent'] });

    expect(byId(items, 'action:new-booking')).toMatchObject({
      kind: 'action',
      label: 'Crea una prenotazione',
      to: '/app/short-rent/bookings/create',
      area: 'short-rent',
    });
    expect(byId(items, 'action:new-property')).toMatchObject({ label: 'Aggiungi un immobile', to: '/app/short-rent/properties/create' });
    expect(byId(items, 'action:new-payment')).toMatchObject({ label: 'Registra un pagamento', to: '/app/short-rent/payments/create' });
    // Nothing of the other areas, no channel (the flag is off), no change of area (there is one).
    expect(byId(items, 'action:new-lease')).toBeUndefined();
    expect(byId(items, 'action:connect-channel')).toBeUndefined();
    expect(items.some((entry) => entry.id.startsWith('action:switch-area'))).toBe(false);
  });

  it('ActionsSource_FlagOfTheChannelsOn_OffersToConnectOne', () => {
    const items = actionsOf({ areas: ['short-rent'], flags: { otaPartnerApi: true } });

    expect(byId(items, 'action:connect-channel')).toMatchObject({ label: 'Collega Airbnb o Booking.com', to: '/app/short-rent/ota/create' });
  });

  it.each([
    ['booking.write', 'action:new-booking'],
    ['property.write', 'action:new-property'],
    ['payment.write', 'action:new-payment'],
  ])('ActionsSource_WithoutThePermission_%s_DoesNotOffer_%s', (missing, actionId) => {
    const without = actionsOf({ areas: ['short-rent'], hasPermission: (_area, permission) => permission !== missing });
    const readOnly = actionsOf({ areas: ['short-rent'], hasPermission: (_area, permission) => permission.endsWith('.read') });

    expect(byId(without, actionId)).toBeUndefined();
    expect(byId(readOnly, actionId)).toBeUndefined();
    expect(byId(actionsOf({ areas: ['short-rent'] }), actionId)).toBeDefined();
  });

  it('ActionsSource_LandlordOfLongRentals_StartsALeaseAndAProperty', () => {
    const items = actionsOf({ areas: ['long-rent'] });

    expect(byId(items, 'action:new-lease')).toMatchObject({ label: 'Nuovo contratto', to: '/app/long-rent/leases/new', area: 'long-rent' });
    expect(byId(items, 'action:new-long-rent-property')).toMatchObject({ label: 'Aggiungi un immobile', to: '/app/long-rent/properties/new' });
    expect(byId(items, 'action:new-booking')).toBeUndefined();
  });

  it('ActionsSource_LeaseWithoutThePermissionToCreateOne_IsNotOffered', () => {
    const items = actionsOf({ areas: ['long-rent'], hasPermission: (_area, permission) => permission !== 'lease.create' });

    expect(byId(items, 'action:new-lease')).toBeUndefined();
    expect(byId(items, 'action:new-long-rent-property')).toBeDefined();
  });

  it('ActionsSource_SupplierAndStaff_StartNothingOfTheHosts', () => {
    for (const area of ['supplier', 'admin'] as const) {
      const items = actionsOf({ areas: [area] });
      expect(items.filter((entry) => entry.to), area).toEqual([]);
    }
  });

  it('ActionsSource_SeveralAreas_TellTheSameActionApartByTheAreaAndOfferTheOtherAreas', () => {
    const items = actionsOf({ areas: ['short-rent', 'long-rent'], activeArea: 'short-rent' });

    expect(byId(items, 'action:new-property')?.subtitle).toBe('Affitti brevi');
    expect(byId(items, 'action:new-long-rent-property')?.subtitle).toBe('Affitti lunghi');
    expect(byId(items, 'action:switch-area:long-rent')).toMatchObject({
      label: 'Cambia area: Affitti lunghi',
      subtitle: 'Contratti, inquilini, scadenze e canoni',
      to: '/app/long-rent',
    });
    // Not to the area the user is in.
    expect(byId(items, 'action:switch-area:short-rent')).toBeUndefined();
  });

  it('ActionsSource_ChangeOfArea_LeadsToTheHomeThatTheWorkspaceGives', () => {
    const items = actionsOf({ areas: ['short-rent', 'long-rent'] });

    expect(byId(items, 'action:switch-area:long-rent')?.to).toBe('/app/long-rent');
  });

  it('ActionsSource_Language_OffersTheOtherOneAndChangesIt', () => {
    const changeLocale = vi.fn();

    const italian = byId(actionsOf({ locale: 'it', actions: { changeLocale } }), 'action:switch-language')!;
    expect(italian.label).toBe("Passa all'inglese");
    italian.run?.();
    expect(changeLocale).toHaveBeenLastCalledWith('en');

    const english = byId(actionsOf({ locale: 'en', actions: { changeLocale } }), 'action:switch-language')!;
    expect(english.label).toBe('Switch to Italian');
    english.run?.();
    expect(changeLocale).toHaveBeenLastCalledWith('it');
  });

  it('ActionsSource_SignOut_SignsOut', () => {
    const signOut = vi.fn();

    byId(actionsOf({ actions: { signOut } }), 'action:sign-out')?.run?.();

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('ActionsSource_SupportAddress_OffersToWriteOnlyWhenTheBuildHasOne', () => {
    const writeToSupport = vi.fn();

    expect(byId(actionsOf({ supportEmail: null }), 'action:support')).toBeUndefined();

    const support = byId(actionsOf({ supportEmail: 'aiuto@casazen.example', actions: { writeToSupport } }), 'action:support')!;
    expect(support.label).toBe("Scrivi all'assistenza");
    support.run?.();
    expect(writeToSupport).toHaveBeenCalledWith('aiuto@casazen.example');
  });

  it('ActionsSource_TheActionsOfTheAccount_AreQuietAndTheOnesThatStartSomethingAreNot', () => {
    const items = actionsOf({ areas: ['short-rent', 'long-rent'], supportEmail: 'aiuto@casazen.example' });

    for (const id of ['action:switch-language', 'action:support', 'action:sign-out']) expect(byId(items, id)?.quiet, id).toBe(true);
    for (const id of ['action:new-booking', 'action:switch-area:long-rent']) expect(byId(items, id)?.quiet, id).toBeUndefined();
  });

  it('ActionsSource_WhatItOffers_HasEitherAPageOrSomethingToDoNeverBoth', () => {
    const items = actionsOf({ areas: ['short-rent', 'long-rent'], supportEmail: 'aiuto@casazen.example', flags: { otaPartnerApi: true } });

    expect(items.length).toBeGreaterThan(8);
    for (const entry of items) expect(Boolean(entry.to) !== Boolean(entry.run), entry.id).toBe(true);
  });

  it('ActionsSource_EveryPageItLeadsTo_ExistsInTheManifestAndOpensForAFullRole', () => {
    const context = makeContext({ areas: ['short-rent', 'long-rent'], flags: { otaPartnerApi: true } });
    const paths = new Set(ROUTE_MANIFEST.map((entry) => entry.path));

    // The home of another area is the one the workspace gives (the API says it): it is not a page asked of the manifest.
    const pages = actionsSource.getItems(context).filter((candidate) => candidate.to && !candidate.id.startsWith('action:switch-area'));
    expect(pages.length).toBeGreaterThan(4);
    for (const entry of pages) {
      expect(paths.has(entry.to as string), entry.id).toBe(true);
      expect(openablePage(context, entry.to as string), entry.id).toBeDefined();
    }
  });
});
