import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AxiosError, AxiosHeaders } from 'axios';
import { useForm } from 'react-hook-form';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import type { ListingChannelStatus, ListingStatus } from '@/types';
import { NEW_PROPERTY_DEFAULTS, type PropertyWizardValues } from '../property-wizard-model';
import { ChannelsStep } from '../steps/channels-step';

const { state, publishMock, goTo } = vi.hoisted(() => ({
  state: {
    status: { data: undefined as unknown, isLoading: false, isError: false, error: null as unknown, refetch: vi.fn() },
    cinCode: 'IT058091C27G5FFZDZ' as string | null,
  },
  publishMock: vi.fn(),
  goTo: vi.fn(),
}));

vi.mock('@/queries/use-listing-status', () => ({
  useListingStatus: () => state.status,
  usePublishListing: () => ({ mutateAsync: publishMock, isPending: false }),
  useResolveOutsideChange: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock('@/queries/use-properties', () => ({ useProperty: () => ({ data: { id: 'p1', cinCode: state.cinCode } }) }));

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

const withRows = (...channels: ListingChannelStatus[]) => {
  state.status = {
    data: { propertyId: 'p1', channels, cinNotSentTo: channels.filter((c) => c.status !== 'ManagedOnChannel').map((c) => c.channel) } satisfies ListingStatus,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  };
};

function refusal(code: string, extra: Record<string, unknown> = {}, httpStatus = 409) {
  return new AxiosError('refused', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: httpStatus,
    statusText: 'Refused',
    data: { code, ...extra },
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

function Harness() {
  const form = useForm<PropertyWizardValues>({ defaultValues: NEW_PROPERTY_DEFAULTS });
  return (
    <MemoryRouter>
      <ChannelsStep form={form} propertyId="p1" goTo={goTo} />
    </MemoryRouter>
  );
}

const channel = (code: string) => screen.getByTestId(`property-wizard-channel-${code}`);
const publishButton = () => screen.getByTestId('property-wizard-publish');

describe('ChannelsStep (E02/F03/US01/T04)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    publishMock.mockReset();
    publishMock.mockResolvedValue({ propertyId: 'p1', channels: [] });
    goTo.mockReset();
    state.cinCode = 'IT058091C27G5FFZDZ';
    withRows();
  });

  it('neverPublished_EveryChannelThatReceivesContentIsThereToChoose_AndTheCinStaysInCasaZen', () => {
    render(<Harness />);

    for (const [code, name] of [['booking_xml', 'Booking.com'], ['airbnb_xml', 'Airbnb'], ['homeaway', 'Vrbo']] as const) {
      expect(within(channel(code)).getByRole('checkbox', { name: `Pubblica su ${name}` })).toBeChecked();
      expect(within(channel(code)).getByText('Da pubblicare')).toBeInTheDocument();
    }
    // The line says where the CIN is not sent yet (NF-30).
    expect(screen.getByTestId('property-wizard-channels-cin-line')).toHaveTextContent('Il CIN resta in CasaZen: per ora non viene inviato a Booking.com, Airbnb, Vrbo.');
  });

  it('eachChannel_StateInWordsCompletenessReasonAndTheStepsThatLackDataWithCorreggi', () => {
    withRows(
      row('booking_xml', { status: 'ToFix', completeness: 60, reason: 'Servono più foto per questo canale: aggiungile nel passaggio delle foto.', missing: ['photos', 'descriptions'] }),
      row('airbnb_xml', { status: 'Sending', completeness: 100 }),
      row('homeaway', { status: 'Published', completeness: 100 }),
    );
    render(<Harness />);

    const booking = channel('booking_xml');
    expect(within(booking).getByText('Da correggere')).toBeInTheDocument();
    expect(within(booking).getByRole('progressbar', { name: 'Completezza del contenuto: 60%' })).toBeInTheDocument();
    expect(screen.getByTestId('property-wizard-channel-reason-booking_xml')).toHaveTextContent('Servono più foto per questo canale');
    // An error on one channel does not hide the others: each one says its own state.
    expect(within(channel('airbnb_xml')).getByText('In invio')).toBeInTheDocument();
    expect(within(channel('homeaway')).getByText('Pubblicato')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('property-wizard-fix-booking_xml-photos'));
    expect(goTo).toHaveBeenCalledWith('photos');
    fireEvent.click(screen.getByTestId('property-wizard-fix-booking_xml-descriptions'));
    expect(goTo).toHaveBeenCalledWith('descriptions');
  });

  it('managedOnTheChannel_SaysSoAndCannotBeChosen', () => {
    withRows(row('expedia', { status: 'ManagedOnChannel', completeness: 100 }));
    render(<Harness />);

    expect(screen.getByTestId('property-wizard-channel-managed-expedia')).toHaveTextContent('Contenuti gestiti su Expedia');
    expect(within(channel('expedia')).queryByRole('checkbox')).not.toBeInTheDocument();
    expect(within(channel('expedia')).getByText('Gestito sul canale')).toBeInTheDocument();
  });

  it('publish_TheChannelsChosen_AreSentAndNothingIsOverwritten', async () => {
    render(<Harness />);

    fireEvent.click(within(channel('airbnb_xml')).getByRole('checkbox'));
    fireEvent.click(publishButton());

    await waitFor(() => expect(publishMock).toHaveBeenCalledWith({ channels: ['booking_xml', 'homeaway'], overwrite: false }));
    expect(await screen.findByTestId('property-wizard-channels-started')).toBeInTheDocument();
  });

  it('publish_NoChannelChosen_TheButtonIsOff', () => {
    render(<Harness />);

    for (const code of ['booking_xml', 'airbnb_xml', 'homeaway']) fireEvent.click(within(channel(code)).getByRole('checkbox'));

    expect(publishButton()).toBeDisabled();
    expect(screen.getByText('Scegli almeno un canale su cui pubblicare.')).toBeInTheDocument();
  });

  it('cin_Missing_PublishWaitsForTheHostToChooseToAddItLater', async () => {
    state.cinCode = null;
    render(<Harness />);

    expect(screen.getByTestId('property-wizard-channels-cin')).toHaveTextContent('Il CIN non c\'è ancora');
    expect(publishButton()).toBeDisabled();

    fireEvent.click(screen.getByTestId('property-wizard-cin-later'));
    expect(screen.getByTestId('property-wizard-cin-later')).toHaveAttribute('aria-pressed', 'true');
    expect(publishButton()).toBeEnabled();
    fireEvent.click(publishButton());

    await waitFor(() => expect(publishMock).toHaveBeenCalled());
  });

  it('refused_TheTextsAreMissing_ListsThemAndCorreggiGoesToTheDescriptions', async () => {
    publishMock.mockRejectedValue(refusal('listing_content_incomplete', { missing: ['en.title', 'en.description'] }, 422));
    render(<Harness />);

    fireEvent.click(publishButton());

    const alert = await screen.findByTestId('property-wizard-channels-incomplete');
    expect(alert).toHaveTextContent('Il titolo in inglese');
    expect(alert).toHaveTextContent('La descrizione in inglese');
    fireEvent.click(within(alert).getByTestId('property-wizard-fix-texts'));
    expect(goTo).toHaveBeenCalledWith('descriptions');
  });

  it('refused_TheListingIsNotMapped_SendsTheHostToTheMappingStepOfTheConnectWizard', async () => {
    publishMock.mockRejectedValue(refusal('octorate_mapping_unconfirmed'));
    render(<Harness />);

    fireEvent.click(publishButton());

    const alert = await screen.findByTestId('property-wizard-channels-mapping');
    expect(within(alert).getByRole('link', { name: 'Vai al collegamento dei canali' })).toHaveAttribute('href', '/app/short-rent/integrations/octorate');
  });

  it('refused_ChangedOutsideCasaZen_OpensTheDialogOfTheChoiceAndPublishesNothing', async () => {
    withRows(row('booking_xml', { status: 'Published', changedOutside: ['descriptions'] }));
    publishMock.mockRejectedValue(refusal('listing_modified_outside', { channels: ['booking_xml'] }));
    render(<Harness />);

    fireEvent.click(publishButton());

    expect(await screen.findByTestId('outside-change-dialog')).toBeInTheDocument();
    expect(publishMock).toHaveBeenCalledTimes(1);
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ overwrite: false }));
  });

  it('statusCannotBeRead_SaysSoAndOffersToTryAgain', () => {
    const refetch = vi.fn();
    state.status = { data: undefined, isLoading: false, isError: true, error: new Error('down'), refetch };
    render(<Harness />);

    expect(screen.getByTestId('property-wizard-channels-error')).toHaveTextContent('Non riesco a leggere lo stato dei canali');
    fireEvent.click(screen.getByRole('button', { name: 'Riprova' }));
    expect(refetch).toHaveBeenCalled();
  });
});
