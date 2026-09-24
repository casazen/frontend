import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n from '@/i18n/config';
import * as icalQueries from '@/queries/use-property-ical';
import type { PropertyIcalFeed } from '@/types/property-ical';
import { IcalSettings } from '../ical-settings';

vi.mock('@/queries/use-property-ical');

const PROPERTY_ID = 'prop-1';

const airbnb: PropertyIcalFeed = {
  id: 'feed-airbnb',
  channel: 'Airbnb',
  label: null,
  maskedImportUrl: 'www.airbnb.it/…9f3a',
  createdAt: '2026-09-01T10:00:00Z',
  lastImportAt: '2026-09-24T08:15:00Z',
  lastImportStatus: 'Success',
  lastErrorCode: null,
  lastError: null,
  blockCount: 3,
};

const booking: PropertyIcalFeed = {
  id: 'feed-booking',
  channel: 'BookingCom',
  label: 'Booking camera 2',
  maskedImportUrl: 'admin.booking.com/…9c0d',
  createdAt: '2026-09-02T10:00:00Z',
  lastImportAt: '2026-09-24T08:10:00Z',
  lastImportStatus: 'Failure',
  lastErrorCode: 'ical_unreachable',
  lastError: 'Server text that must not be shown when the code is known',
  blockCount: 1,
};

const syncingFeed: PropertyIcalFeed = {
  id: 'feed-other',
  channel: 'Other',
  label: null,
  maskedImportUrl: 'calendar.google.com/….ics',
  createdAt: '2026-09-03T10:00:00Z',
  lastImportAt: null,
  lastImportStatus: 'Syncing',
  lastErrorCode: null,
  lastError: null,
  blockCount: 0,
};

type FeedsResult = ReturnType<typeof icalQueries.usePropertyIcalFeeds>;

function mockFeeds(result: Partial<FeedsResult>) {
  vi.mocked(icalQueries.usePropertyIcalFeeds).mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
    ...result,
  } as unknown as FeedsResult);
}

function mockMutation<T extends (...args: never[]) => unknown>(hook: T) {
  const mutate = vi.fn();
  vi.mocked(hook).mockReturnValue({ mutate, isPending: false, variables: undefined } as unknown as ReturnType<T>);
  return mutate;
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <IcalSettings propertyId={PROPERTY_ID} />
    </MemoryRouter>,
  );
}

describe('IcalSettings feed list (PC-11)', () => {
  let add: ReturnType<typeof vi.fn>;
  let remove: ReturnType<typeof vi.fn>;
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('it');
    vi.mocked(icalQueries.usePropertyIcalExportUrl).mockReturnValue({
      data: { exportUrl: 'https://api.example.com/api/public/ical/token' },
      isError: false,
    } as unknown as ReturnType<typeof icalQueries.usePropertyIcalExportUrl>);
    add = mockMutation(icalQueries.useAddPropertyIcalFeed);
    remove = mockMutation(icalQueries.useRemovePropertyIcalFeed);
    sync = mockMutation(icalQueries.useSyncPropertyIcalFeed);
  });

  it('renders_TwoFeeds_ShowsEachWithNameMaskedUrlStatusAndBlocks', () => {
    mockFeeds({ data: [airbnb, booking] });

    renderSettings();

    const rows = screen.getAllByTestId('ical-feed-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('Airbnb')).toBeInTheDocument();
    expect(within(rows[0]).getByText('www.airbnb.it/…9f3a')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Sincronizzato')).toBeInTheDocument();
    expect(within(rows[0]).getByText(/3 periodi bloccati importati/)).toBeInTheDocument();
    // A label replaces the channel name, the channel stays as a badge.
    expect(within(rows[1]).getByText('Booking camera 2')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Booking.com')).toBeInTheDocument();
  });

  it('renders_FailedFeed_ShowsTheErrorTranslatedFromItsCode', () => {
    mockFeeds({ data: [booking] });

    renderSettings();

    const row = screen.getByTestId('ical-feed-row');
    expect(within(row).getByText('Errore')).toBeInTheDocument();
    expect(
      within(row).getByText(
        'Non è stato possibile scaricare il calendario: verifica che il link sia corretto e accessibile pubblicamente.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(booking.lastError!)).not.toBeInTheDocument();
  });

  it('renders_SyncingFeed_TranslatesTheStateAndDisablesSyncNow', () => {
    mockFeeds({ data: [syncingFeed] });

    renderSettings();

    const row = screen.getByTestId('ical-feed-row');
    expect(within(row).getByText('Sincronizzazione in corso')).toBeInTheDocument();
    expect(within(row).getByText(/Mai sincronizzato/)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: /Sincronizzazione…/ })).toBeDisabled();
  });

  it('syncNow_click_SyncsThatFeedOnly', () => {
    mockFeeds({ data: [airbnb, booking] });

    renderSettings();
    fireEvent.click(within(screen.getAllByTestId('ical-feed-row')[1]).getByRole('button', { name: /Sincronizza ora/ }));

    expect(sync).toHaveBeenCalledWith('feed-booking');
  });

  it('remove_confirmed_RemovesThatFeed', () => {
    mockFeeds({ data: [airbnb, booking] });

    renderSettings();
    fireEvent.click(within(screen.getAllByTestId('ical-feed-row')[0]).getByRole('button', { name: /Scollega/ }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/importate da Airbnb tornano libere/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Scollega' }));

    expect(remove).toHaveBeenCalledWith('feed-airbnb', expect.anything());
  });

  it('addFeed_submit_SendsChannelLabelAndUrl', () => {
    mockFeeds({ data: [airbnb] });

    renderSettings();
    fireEvent.change(screen.getByLabelText('Canale'), { target: { value: 'BookingCom' } });
    fireEvent.change(screen.getByLabelText('Etichetta (facoltativa)'), { target: { value: ' Camera 2 ' } });
    fireEvent.change(screen.getByLabelText('URL import (HTTPS)'), {
      target: { value: ' https://admin.booking.com/ical.html?t=1 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi e sincronizza' }));

    expect(add).toHaveBeenCalledWith(
      { channel: 'BookingCom', label: 'Camera 2', importUrl: 'https://admin.booking.com/ical.html?t=1' },
      expect.anything(),
    );
  });

  it('renders_NoFeeds_ShowsTheEmptyState', () => {
    mockFeeds({ data: [] });

    renderSettings();

    expect(screen.getByText(/Nessun calendario collegato/)).toBeInTheDocument();
    expect(screen.queryAllByTestId('ical-feed-row')).toHaveLength(0);
  });

  it('renders_LoadError_ShowsErrorAndRetryNotAnEmptyList', () => {
    const refetch = vi.fn();
    mockFeeds({ isError: true, refetch });

    renderSettings();

    expect(screen.getByRole('alert')).toHaveTextContent('Impossibile caricare i calendari collegati.');
    expect(screen.queryByText(/Nessun calendario collegato/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(refetch).toHaveBeenCalled();
  });

  it('renders_Loading_ShowsSpinner', () => {
    mockFeeds({ isLoading: true });

    renderSettings();

    expect(screen.getByTestId('ical-feeds-loading')).toBeInTheDocument();
    expect(screen.queryByText(/Nessun calendario collegato/)).not.toBeInTheDocument();
  });
});
