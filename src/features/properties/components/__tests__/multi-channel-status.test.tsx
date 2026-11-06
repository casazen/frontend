import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { ListingChannelStatus } from '@/types';
import { ChannelSummary, ChannelsCell, MultiChannelStatus } from '../multi-channel-status';

const { state } = vi.hoisted(() => ({
  state: { data: undefined as unknown, isLoading: false, isError: false },
}));

vi.mock('@/queries/use-listing-status', () => ({ useListingStatus: () => state }));

const row = (channel: string, overrides: Partial<ListingChannelStatus> = {}): ListingChannelStatus => ({
  channel,
  status: 'Published',
  completeness: 100,
  missing: [],
  lastSyncedAt: null,
  syncLagSeconds: null,
  syncAlert: false,
  errorCode: null,
  reason: null,
  reasonDetail: null,
  changedOutside: [],
  ...overrides,
});

const channels = (...rows: ListingChannelStatus[]) => {
  state.data = { propertyId: 'p1', channels: rows, cinNotSentTo: [] };
  state.isLoading = false;
  state.isError = false;
};

describe('ChannelSummary (the property list)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('worstState_InWordsWithAnIcon_AndTheLateSyncBadge', () => {
    render(
      <MemoryRouter>
        <ChannelSummary propertyId="p1" worstStatus="Accepted" syncAlert canWrite />
      </MemoryRouter>,
    );

    const summary = screen.getByTestId('channel-summary');
    expect(summary).toHaveAttribute('data-status', 'Accepted');
    expect(within(summary).getByText('Preso in carico')).toBeInTheDocument();
    expect(within(summary).getByTestId('sync-delayed-badge')).toHaveTextContent('Sincronizzazione in ritardo');
    expect(within(summary).queryByTestId('channel-fix')).not.toBeInTheDocument();
  });

  it('toFix_CorreggiOpensTheWizardAtTheChannels_OnlyForWhoMayWrite', () => {
    const { rerender } = render(
      <MemoryRouter>
        <ChannelSummary propertyId="p1" worstStatus="ToFix" syncAlert={false} canWrite />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('channel-fix')).toHaveAttribute('href', '/app/short-rent/properties/create?propertyId=p1&step=channels');
    expect(screen.queryByTestId('sync-delayed-badge')).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <ChannelSummary propertyId="p1" worstStatus="ToFix" syncAlert={false} canWrite={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('channel-fix')).not.toBeInTheDocument();
  });
});

describe('ChannelsCell (the column «Canali» of the list)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  const cell = (props: { summary?: { propertyId: string; worstStatus: 'Published'; syncAlert: boolean }; known: boolean }) =>
    render(
      <MemoryRouter>
        <ChannelsCell propertyId="p1" canWrite {...props} />
      </MemoryRouter>,
    );

  it('theSummaryIsNotReadYet_OrCouldNotBeRead_SaysNothingIsKnown_NeverNonPubblicato', () => {
    // While it loads, or after a failed read, the summary has no entry for anybody: that is not «never published».
    cell({ known: false });

    expect(screen.getByTestId('channels-unknown')).toHaveTextContent('Stato dei canali non ancora disponibile');
    expect(screen.queryByText('Non pubblicato')).not.toBeInTheDocument();
  });

  it('theSummaryWasRead_AMissingPropertyIsNonPubblicato_APropertyWithAChannelShowsItsWorstState', () => {
    const { unmount } = cell({ known: true });
    expect(screen.getByText('Non pubblicato')).toBeInTheDocument();
    expect(screen.queryByTestId('channels-unknown')).not.toBeInTheDocument();
    unmount();

    cell({ known: true, summary: { propertyId: 'p1', worstStatus: 'Published', syncAlert: false } });
    expect(screen.getByTestId('channel-summary')).toHaveAttribute('data-status', 'Published');
    expect(screen.queryByText('Non pubblicato')).not.toBeInTheDocument();
  });
});

describe('MultiChannelStatus (the sheet of the property)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('oneBadgeForEachChannel_GreenYellowRedGrey_WithWords', () => {
    channels(
      row('booking_xml', { status: 'Published' }),
      row('airbnb_xml', { status: 'Sending' }),
      row('homeaway', { status: 'ToFix', reason: 'Servono più foto per questo canale: aggiungile nel passaggio delle foto.', missing: ['photos'] }),
      row('expedia', { status: 'ManagedOnChannel' }),
    );
    render(
      <MemoryRouter>
        <MultiChannelStatus propertyId="p1" canWrite />
      </MemoryRouter>,
    );

    expect(within(screen.getByTestId('multi-channel-booking_xml')).getByText('Pubblicato')).toBeInTheDocument();
    expect(within(screen.getByTestId('multi-channel-airbnb_xml')).getByText('In invio')).toBeInTheDocument();
    expect(within(screen.getByTestId('multi-channel-homeaway')).getByText('Da correggere')).toBeInTheDocument();
    expect(screen.getByTestId('multi-channel-homeaway')).toHaveTextContent('Servono più foto per questo canale');
    expect(within(screen.getByTestId('multi-channel-expedia')).getByText('Gestito sul canale')).toBeInTheDocument();
    // The colours are told by the tone of each badge, never by the colour alone: every badge has its word and its icon.
    expect(screen.getByTestId('multi-channel-status').querySelectorAll('[data-status-kind="channel"] svg')).toHaveLength(4);
  });

  it('correggi_OpensTheWizardAtTheFirstStepThatLacksData', () => {
    channels(row('booking_xml', { status: 'ToFix', missing: ['prices', 'photos'] }), row('airbnb_xml', { missing: ['descriptions'] }));
    render(
      <MemoryRouter>
        <MultiChannelStatus propertyId="p1" canWrite />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('multi-channel-fix')).toHaveAttribute('href', '/app/short-rent/properties/create?propertyId=p1&step=photos');
  });

  it('syncAlert_ShowsTheLateSyncBadgeOnThatChannelOnly', () => {
    channels(row('booking_xml', { syncAlert: true }), row('airbnb_xml'));
    render(
      <MemoryRouter>
        <MultiChannelStatus propertyId="p1" canWrite={false} />
      </MemoryRouter>,
    );

    expect(within(screen.getByTestId('multi-channel-booking_xml')).getByTestId('sync-delayed-badge')).toBeInTheDocument();
    expect(within(screen.getByTestId('multi-channel-airbnb_xml')).queryByTestId('sync-delayed-badge')).not.toBeInTheDocument();
  });

  it('allPublished_NoFixButton_AndForWhoMayOnlyReadNeverOne', () => {
    channels(row('booking_xml'));
    const { rerender } = render(
      <MemoryRouter>
        <MultiChannelStatus propertyId="p1" canWrite />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('multi-channel-fix')).not.toBeInTheDocument();

    channels(row('booking_xml', { status: 'ToFix' }));
    rerender(
      <MemoryRouter>
        <MultiChannelStatus propertyId="p1" canWrite={false} />
      </MemoryRouter>,
    );
    expect(screen.queryByTestId('multi-channel-fix')).not.toBeInTheDocument();
  });

  it('neverPublished_SaysSo_AndAFailedReadSaysThatInstead', () => {
    channels();
    const { rerender } = render(
      <MemoryRouter>
        <MultiChannelStatus propertyId="p1" canWrite />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('multi-channel-status-empty')).toHaveTextContent('Non ancora pubblicato su nessun canale');

    state.data = undefined;
    state.isError = true;
    rerender(
      <MemoryRouter>
        <MultiChannelStatus propertyId="p1" canWrite />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('multi-channel-status-error')).toBeInTheDocument();
  });
});
