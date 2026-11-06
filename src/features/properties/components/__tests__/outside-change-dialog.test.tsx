import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { ListingChannelStatus } from '@/types';
import { OutsideChangeDialog } from '../outside-change-dialog';

const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));

vi.mock('@/queries/use-listing-status', () => ({
  useResolveOutsideChange: () => ({ mutateAsync: resolveMock, isPending: false }),
}));

const row = (channel: string, changedOutside: string[]): ListingChannelStatus => ({
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
  changedOutside,
});

function open(rows: ListingChannelStatus[], onOpenChange = vi.fn()) {
  render(<OutsideChangeDialog open onOpenChange={onOpenChange} propertyId="p1" rows={rows} />);
  return onOpenChange;
}

describe('OutsideChangeDialog (NF-27)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    resolveMock.mockReset();
    resolveMock.mockResolvedValue(undefined);
  });

  it('showsWhatChangedOnEachChannel_AndTheTwoChoices', () => {
    open([row('booking_xml', ['descriptions'])]);

    expect(screen.getByRole('dialog')).toHaveTextContent('Modificato fuori da CasaZen');
    const channel = screen.getByTestId('outside-change-booking_xml');
    expect(channel).toHaveTextContent('Booking.com');
    expect(channel).toHaveTextContent('Cambiato fuori da CasaZen: Descrizioni.');
    expect(within(channel).getByRole('button', { name: 'Tieni la versione di CasaZen' })).toBeInTheDocument();
    expect(within(channel).getByRole('button', { name: 'Prendi la nuova versione' })).toBeInTheDocument();
  });

  it('take_IsOfferedOnlyWhenTheDescriptionsAreTheOnlyGroupThatChanged', () => {
    open([row('booking_xml', ['descriptions', 'rooms'])]);

    const channel = screen.getByTestId('outside-change-booking_xml');
    expect(within(channel).queryByRole('button', { name: 'Prendi la nuova versione' })).not.toBeInTheDocument();
    expect(channel).toHaveTextContent('Descrizioni, Camere e letti');
    expect(within(channel).getByRole('button', { name: 'Tieni la versione di CasaZen' })).toBeInTheDocument();
  });

  it('keep_AsksFirstAndSaysWhatIsLost_NothingIsSentUntilTheHostConfirms', async () => {
    open([row('booking_xml', ['descriptions', 'rooms'])]);

    fireEvent.click(screen.getByRole('button', { name: 'Tieni la versione di CasaZen' }));

    const confirm = screen.getByTestId('outside-change-confirm');
    expect(confirm).toHaveTextContent('Le modifiche fatte fuori da CasaZen andranno perse: Descrizioni, Camere e letti. Continuare?');
    expect(resolveMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('outside-change-continue'));
    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith({ channelCode: 'booking_xml', choice: 'keep' }));
  });

  it('take_AsksFirstAndSaysThatTheirChangesInCasaZenAreLost', async () => {
    open([row('airbnb_xml', ['descriptions'])]);

    fireEvent.click(screen.getByRole('button', { name: 'Prendi la nuova versione' }));

    expect(screen.getByTestId('outside-change-confirm')).toHaveTextContent('Le tue modifiche in CasaZen andranno perse: i titoli e le descrizioni scritti in CasaZen. Continuare?');
    expect(resolveMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('outside-change-continue'));
    await waitFor(() => expect(resolveMock).toHaveBeenCalledWith({ channelCode: 'airbnb_xml', choice: 'take' }));
  });

  it('confirmation_Back_ChangesNothing', () => {
    open([row('booking_xml', ['descriptions'])]);

    fireEvent.click(screen.getByRole('button', { name: 'Tieni la versione di CasaZen' }));
    fireEvent.click(screen.getByRole('button', { name: 'Indietro' }));

    expect(screen.queryByTestId('outside-change-confirm')).not.toBeInTheDocument();
    expect(screen.getByTestId('outside-change-booking_xml')).toBeInTheDocument();
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('theLastChannelDecided_ClosesTheDialog_AFailureKeepsItOpenWithTheReason', async () => {
    const onOpenChange = open([row('booking_xml', ['descriptions'])]);
    resolveMock.mockRejectedValueOnce(new Error('network'));

    fireEvent.click(screen.getByRole('button', { name: 'Tieni la versione di CasaZen' }));
    fireEvent.click(screen.getByTestId('outside-change-continue'));
    expect(await screen.findByTestId('outside-change-error')).toHaveTextContent('Non siamo riusciti a registrare la scelta');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTestId('outside-change-continue'));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
