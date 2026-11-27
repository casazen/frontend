import { fireEvent, render, screen, within } from '@testing-library/react';
import { useForm, useWatch } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { BaseStep } from '../steps/base-step';
import { NEW_PROPERTY_DEFAULTS, type PropertyWizardValues } from '../property-wizard-model';
import { RoomsEditor } from '../steps/rooms-editor';

// The comune picker reads the official list: the first step is rendered here for its counters only.
vi.mock('@/queries/use-comuni', () => ({
  useComuneDatasetStatus: () => ({ data: { datasetAvailable: false }, isPending: false, isError: false, refetch: vi.fn() }),
  useComuneSearch: () => ({ data: undefined, isFetching: false, isError: false, isSuccess: false, refetch: vi.fn() }),
  useComune: () => ({ data: undefined, isError: false }),
}));

function Harness({
  values = NEW_PROPERTY_DEFAULTS,
  withBaseStep = false,
  storedRoomCount = 0,
}: {
  values?: PropertyWizardValues;
  withBaseStep?: boolean;
  storedRoomCount?: number;
}) {
  const form = useForm<PropertyWizardValues>({ defaultValues: values });
  const [bedrooms, beds, rooms] = useWatch({ control: form.control, name: ['bedrooms', 'beds', 'rooms'] });
  return (
    <>
      {withBaseStep ? <BaseStep form={form} storedRoomCount={storedRoomCount} /> : <RoomsEditor form={form} storedRoomCount={storedRoomCount} />}
      <output data-testid="counters">{`${bedrooms}/${beds}`}</output>
      <output data-testid="rooms">{JSON.stringify(rooms.map((room) => [room.type, room.beds.map((bed) => [bed.type, bed.count])]))}</output>
    </>
  );
}

const rooms = () => JSON.parse(screen.getByTestId('rooms').textContent ?? '[]') as Array<[string, Array<[string, number]>]>;

describe('RoomsEditor (NF-34)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('empty_SaysThatTheCountersAreTheHostsAndOffersTheFirstRoom', () => {
    render(<Harness />);

    expect(screen.queryAllByTestId('property-wizard-room')).toHaveLength(0);
    expect(screen.getByText(/camere da letto e letti si calcolano da qui/)).toBeInTheDocument();
    expect(screen.getByTestId('property-wizard-room-add')).toHaveTextContent('Elenca le camere e i letti');
  });

  it('addRoom_StartsWithOneDoubleBed_AndTheCountersFollowTheRooms', () => {
    render(<Harness />);

    fireEvent.click(screen.getByTestId('property-wizard-room-add'));
    expect(rooms()).toEqual([['Bedroom', [['Double', 1]]]]);
    expect(screen.getByTestId('counters')).toHaveTextContent('1/1');

    fireEvent.click(screen.getByTestId('property-wizard-room-add'));
    expect(screen.getAllByTestId('property-wizard-room')).toHaveLength(2);
    expect(screen.getByTestId('counters')).toHaveTextContent('2/2');
  });

  it('bedsOfARoom_AddAKind_ChangeTheCount_RemoveOne', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('property-wizard-room-add'));

    fireEvent.click(screen.getByTestId('property-wizard-bed-add'));
    expect(rooms()[0]![1]).toEqual([['Double', 1], ['Single', 1]]);

    const second = screen.getAllByTestId('property-wizard-bed')[1]!;
    fireEvent.click(within(second).getByRole('button', { name: /Aumenta/i }));
    expect(rooms()[0]![1]).toEqual([['Double', 1], ['Single', 2]]);
    expect(screen.getByTestId('counters')).toHaveTextContent('1/3');

    fireEvent.click(within(second).getByRole('button', { name: /Togli Singolo/ }));
    expect(rooms()[0]![1]).toEqual([['Double', 1]]);
  });

  it('roomType_ASittingRoomIsNotABedroom_SoTheBedroomsCounterDoesNotCountIt', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('property-wizard-room-add'));
    fireEvent.click(screen.getByTestId('property-wizard-room-add'));

    fireEvent.change(screen.getAllByTestId('property-wizard-room-type')[1]!, { target: { value: 'LivingRoom' } });

    expect(rooms().map(([type]) => type)).toEqual(['Bedroom', 'LivingRoom']);
    expect(screen.getByTestId('counters')).toHaveTextContent('1/2');
  });

  it('removeRoom_TakesItOffTheList_AndTheCountersKeepTheLastValueWhenNoneIsLeft', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('property-wizard-room-add'));
    fireEvent.click(screen.getByTestId('property-wizard-room-add'));

    fireEvent.click(screen.getAllByTestId('property-wizard-room-remove')[0]!);
    expect(rooms()).toHaveLength(1);
    expect(screen.getByTestId('counters')).toHaveTextContent('1/1');

    fireEvent.click(screen.getByTestId('property-wizard-room-remove'));
    expect(rooms()).toHaveLength(0);
    expect(screen.getByTestId('counters')).toHaveTextContent('1/1');
  });

  it('removeRoom_TheLastRoomThatIsSaved_CannotBeTakenOff_TheServerTakesNoEmptyList', () => {
    // The server keeps one room: the editor starts from it, and taking it off would change nothing there (it would come back).
    const withOne = { ...NEW_PROPERTY_DEFAULTS, rooms: [{ key: 'room-1', type: 'Bedroom' as const, beds: [{ type: 'Double' as const, count: 1 }] }] };
    render(<Harness values={withOne} storedRoomCount={1} />);

    expect(screen.getByTestId('property-wizard-room-remove')).toBeDisabled();
    expect(screen.getByTestId('property-wizard-rooms-last-saved')).toHaveTextContent('non si può togliere');

    // Another room next to it: now either can go (the other stays), and the last one is locked again.
    fireEvent.click(screen.getByTestId('property-wizard-room-add'));
    expect(screen.queryByTestId('property-wizard-rooms-last-saved')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByTestId('property-wizard-room-remove')[0]!);
    expect(rooms()).toHaveLength(1);
    expect(screen.getByTestId('property-wizard-room-remove')).toBeDisabled();
  });

  it('removeRoom_NothingIsSavedYet_TheOnlyRoomCanBeTakenOff', () => {
    render(<Harness storedRoomCount={0} />);
    fireEvent.click(screen.getByTestId('property-wizard-room-add'));

    expect(screen.getByTestId('property-wizard-room-remove')).toBeEnabled();
    expect(screen.queryByTestId('property-wizard-rooms-last-saved')).not.toBeInTheDocument();
  });

  it('firstStep_WithRooms_TheCountersAreReadFromThemAndNotTyped', () => {
    render(<Harness withBaseStep />);
    // Without rooms the host types the counters.
    expect(screen.getByTestId('property-wizard-bedrooms')).toBeInTheDocument();
    expect(screen.queryByTestId('property-wizard-bedrooms-derived')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('property-wizard-room-add'));

    expect(screen.queryByTestId('property-wizard-bedrooms')).not.toBeInTheDocument();
    expect(screen.getByTestId('property-wizard-bedrooms-derived')).toHaveTextContent('1');
    expect(screen.getByTestId('property-wizard-beds-derived')).toHaveTextContent('1');
    // The guests and the bathrooms are not derived from the rooms.
    expect(screen.getByTestId('property-wizard-maxGuests')).toBeInTheDocument();
    expect(screen.getByTestId('property-wizard-bathrooms')).toBeInTheDocument();
  });
});
