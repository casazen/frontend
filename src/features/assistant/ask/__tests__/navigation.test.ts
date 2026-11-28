import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bookingsApi } from '@/api/bookings.api';
import { internalActivitiesApi } from '@/api/internal-activities.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import type { CommandContext } from '@/components/shared/command-palette/types';
import { searchManual, type ManualHit } from '@/lib/manual/manual-search';
import type { BookingListItem } from '@/types';
import { fiscalPeriod, resolveAsk } from '../navigation';

vi.mock('@/api/bookings.api', () => ({ bookingsApi: { search: vi.fn() } }));
vi.mock('@/api/internal-activities.api', () => ({ internalActivitiesApi: { getPending: vi.fn() } }));
vi.mock('@/api/client', () => ({ ApiClient: { post: vi.fn().mockRejectedValue(new Error('offline')) } }));
vi.mock('@/lib/manual/manual-search', () => ({ searchManual: vi.fn().mockResolvedValue([]) }));

const HOWTO: ManualHit = {
  id: 'immobili.html#pausa',
  type: 'howto',
  title: 'Mettere in pausa e riattivare un immobile',
  chapter: 'Immobili',
  href: '/guida/immobili.html#pausa',
};

const context = {
  t: ((name: string) => name) as CommandContext['t'],
  activeArea: 'short-rent',
  areas: [],
  hasPermission: () => true,
  flags: { ...DEFAULT_FEATURE_FLAGS, routines: true, fiscalDocumentIssuance: true },
  canOpenPath: () => true,
  locale: 'it',
} as CommandContext;
const ask = (query: string, current = context) => resolveAsk(query, current, 'Quokka360', new AbortController().signal);
const booking = (id: string) => ({
  id, bookingCode: 'REF-' + id, propertyName: 'Loft', checkInDate: '2026-10-03', guest: { firstName: 'Giulia', lastName: 'Rossi' },
} as BookingListItem);
const setBookings = (...items: BookingListItem[]) =>
  vi.mocked(bookingsApi.search).mockResolvedValue({ items, totalCount: items.length, page: 1, pageSize: 20 });

describe('Ask CasaZen navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens a single exact booking and offers a choice when homonyms exist', async () => {
    setBookings(booking('one'));
    expect(await ask('Apri la prenotazione di Giulia Rossi')).toMatchObject({ direct: true, links: [{ to: '/app/short-rent/bookings/one' }] });
    setBookings(booking('one'), booking('two'));
    const answer = await ask('Apri la prenotazione di Giulia Rossi');
    expect(answer.direct).toBeUndefined();
    expect(answer.links.slice(0, 2).map(link => link.to)).toEqual(['/app/short-rent/bookings/one', '/app/short-rent/bookings/two']);
  });

  it('suggests similar bookings without opening them and avoids lookup without permission', async () => {
    vi.mocked(bookingsApi.search).mockResolvedValueOnce({ items: [], totalCount: 0, page: 1, pageSize: 20 });
    setBookings(booking('one'));
    expect(await ask('Apri la prenotazione di Giula Rossi')).toMatchObject({ message: 'ask.bookingChoices' });
    expect(vi.mocked(bookingsApi.search).mock.lastCall?.[0].q).toBe('Rossi');
    vi.clearAllMocks();
    expect(await ask('Apri la prenotazione di Giulia Rossi', { ...context, hasPermission: () => false })).toEqual({ links: [], message: 'ask.accessUnavailable' });
    expect(bookingsApi.search).not.toHaveBeenCalled();
  });

  it('routes presets and custom agents, settings and Alloggiati', async () => {
    expect((await ask('Voglio creare una routine per gestire le mail del checkin')).links[0].to).toContain('view=library&preset=arrival');
    expect((await ask('Crea una routine per aggiornare i tag')).links[0]).toMatchObject({ to: '/app/short-rent/automations?view=create', state: { agentObjective: expect.any(String) } });
    expect((await ask('Apri i settings')).links[0].to).toBe('/app/short-rent/settings/organization');
    expect((await ask('Apri il report degli alloggiati')).links[0].to).toBe('/app/short-rent/alloggiati/reports');
  });

  it('prefills an invitation in the current organization and applies a calendar period', async () => {
    expect(await ask('Invita Marco come collaboratore in Quokka')).toMatchObject({ direct: true, links: [{
      to: '/app/account/people/invite?role=collaborator&area=short-rent', state: { invite: { name: 'Marco', email: '' } },
    }] });
    expect((await ask('Invita Marco come collaboratore in Altra')).links).toEqual([]);
    expect(fiscalPeriod('fammi vedere le fatture di ottobre', '2026-11-18')).toBe('?from=2026-10-01&to=2026-10-31');
    expect((await ask('Fammi vedere le fatture di ottobre 2026')).links[0].to)
      .toBe('/app/short-rent/fiscal/documents?from=2026-10-01&to=2026-10-31&kind=Invoice');
  });

  it('answers a how-to question from the manual, and says no page fits only when the manual has nothing either', async () => {
    vi.mocked(searchManual).mockResolvedValueOnce([HOWTO]);
    const question = 'Come faccio a mettere in pausa una casa?';

    expect(await ask(question)).toEqual({ links: [], guide: [HOWTO], message: undefined });
    expect(searchManual).toHaveBeenCalledWith(question, 4);
    expect(await ask(question)).toEqual({ links: [], guide: [], message: 'ask.noPages' });
  });

  it('keeps answering when the manual cannot be read or does not answer in time', async () => {
    vi.mocked(searchManual).mockRejectedValueOnce(new Error('offline'));
    expect(await ask('Come faccio a mettere in pausa una casa?')).toMatchObject({ guide: [], message: 'ask.noPages' });

    vi.useFakeTimers();
    try {
      vi.mocked(searchManual).mockReturnValueOnce(new Promise(() => {}));
      const pending = ask('Come faccio a mettere in pausa una casa?');
      await vi.advanceTimersByTimeAsync(3000);
      expect(await pending).toMatchObject({ guide: [], message: 'ask.noPages' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('reads the current to-do list with routine reminders excluded', async () => {
    vi.mocked(internalActivitiesApi.getPending).mockResolvedValue([]);
    expect((await ask('Dimmi se ci sono cose da fare')).links[0].to).toBe('/app/short-rent/activities');
    expect(internalActivitiesApi.getPending).toHaveBeenCalledWith(true);
  });
});
