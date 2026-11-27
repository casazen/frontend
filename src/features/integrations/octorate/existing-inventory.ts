import type { ChannelAccessState, ExistingImportStatus, ExistingInventoryBatch, ExistingInventoryChannel, ExistingInventoryItem } from '@/types';

/**
 * What the screens of the import of existing inventory (E02/F01/US03, D6) read from a batch: how the access to each channel reads in the list of
 * the channels, how far each channel is along the sequence of the import, and what there is left to wait for. The server decides every state; this
 * only names them in the words of the wizard, so a state it does not know yet reads as «da collegare», never as a success.
 */

/** The states the host reads for the access to a channel (the wizard names them «Da collegare», «In attesa del login», «Verifica in corso», «Collegato», «Da confermare», «Errore»). */
export type ChannelAccessView = 'notStarted' | 'waiting' | 'verifying' | 'connected' | 'needsConfirmation' | 'error';

/** True when the access to the channel is given: seen by CasaZen, or confirmed by the host after CasaZen could not check it. */
export function isAccessGiven(channel: Pick<ExistingInventoryChannel, 'accessState'>): boolean {
  return channel.accessState === 'Verified' || channel.accessState === 'Confirmed';
}

const ACCESS_VIEW: Readonly<Record<ChannelAccessState, ChannelAccessView>> = {
  NotStarted: 'notStarted',
  Waiting: 'waiting',
  Verifying: 'verifying',
  NeedsConfirmation: 'needsConfirmation',
  Verified: 'connected',
  Confirmed: 'connected',
  NotValid: 'error',
};

/** The state of the access to a channel as the list shows it. A channel that failed before its access was ever given reads as an error. */
export function channelAccessView(channel: Pick<ExistingInventoryChannel, 'accessState' | 'status'>): ChannelAccessView {
  const view = Object.hasOwn(ACCESS_VIEW, channel.accessState) ? ACCESS_VIEW[channel.accessState] : 'notStarted';
  return view === 'notStarted' && channel.status === 'Failed' ? 'error' : view;
}

/** The access is being followed: the host is on the panel, or CasaZen is checking. The batch is read again while any channel is. */
export function isAccessPending(channel: Pick<ExistingInventoryChannel, 'accessState'>): boolean {
  return channel.accessState === 'Waiting' || channel.accessState === 'Verifying';
}

/** Where a channel is in its own words of the wizard: the sequence of the import, each step with its state. */
export const IMPORT_SEQUENCE = ['rooms', 'mapping', 'reservations', 'calendar', 'connected'] as const;
export type ImportSequenceStep = (typeof IMPORT_SEQUENCE)[number];

/** `attention`: the step waits for the host (the mapping) or stopped with a code (a failed or stopped channel). */
export type ImportStepState = 'done' | 'current' | 'pending' | 'attention';

/** The statuses in which CasaZen is working on a channel: the batch is read again while any channel is in one of them. */
const WORKING: ReadonlySet<ExistingImportStatus> = new Set(['ImportingRooms', 'ImportingReservations', 'ImportingCalendar', 'MarkingConnected']);

/** The index in {@link IMPORT_SEQUENCE} of the step a working or waiting status is at. */
const SEQUENCE_INDEX: Readonly<Partial<Record<ExistingImportStatus, number>>> = {
  ImportingRooms: 0,
  AwaitingMapping: 1,
  ImportingReservations: 2,
  ImportingCalendar: 3,
  MarkingConnected: 4,
};

/** True for a channel that stopped with a code: the host retries it or asks for help, and the other channels are not affected. */
export function isChannelStopped(channel: Pick<ExistingInventoryChannel, 'status'>): boolean {
  return channel.status === 'Failed' || channel.status === 'NeedsAttention';
}

/** The step a channel that stopped got to: the first one its counts do not show done. */
function stoppedAt(channel: ExistingInventoryChannel): number {
  const { counts } = channel;
  if (channel.roomsImportedAt === null) return 0;
  if (counts.pending > 0) return 1;
  if (counts.reservationsImported < counts.confirmed) return 2;
  if (counts.calendarImported < counts.confirmed) return 3;
  return 4;
}

/**
 * The sequence «Annunci e camere», «Abbinamento», «Prenotazioni», «Calendario», «Collegamento completato» of a channel, each step done, current,
 * waiting for the host (`attention`) or not reached. The last one is done only when the server says the channel is `Completed`: the screen never
 * shows completion before that.
 */
export function importSequence(channel: ExistingInventoryChannel): Array<{ id: ImportSequenceStep; state: ImportStepState }> {
  if (channel.status === 'Completed') return IMPORT_SEQUENCE.map((id) => ({ id, state: 'done' }));

  const stopped = isChannelStopped(channel);
  const reached = stopped ? stoppedAt(channel) : (SEQUENCE_INDEX[channel.status] ?? -1);

  return IMPORT_SEQUENCE.map((id, index): { id: ImportSequenceStep; state: ImportStepState } => {
    if (index < reached) return { id, state: 'done' };
    if (index > reached) return { id, state: 'pending' };
    return { id, state: stopped || channel.status === 'AwaitingMapping' ? 'attention' : 'current' };
  });
}

/** True while the access to some channel is being followed: a screen that waits for the access reads the batch again. */
export function isWaitingForAccess(batch: ExistingInventoryBatch | undefined): boolean {
  return batch?.channels.some(isAccessPending) ?? false;
}

/** True while CasaZen is working on some channel: the screen of the progress reads the batch again. */
export function isImporting(batch: ExistingInventoryBatch | undefined): boolean {
  return batch?.channels.some((channel) => WORKING.has(channel.status)) ?? false;
}

/**
 * True when the rooms of some channel still have to be imported and its access is given: the progress step starts the batch (`run`) for it. A
 * channel whose rooms are in (or that is already further along) is never asked again by itself, and a channel that stopped is run again by the
 * host's «Riprova», never by the screen.
 */
export function shouldStartRun(batch: ExistingInventoryBatch | undefined): boolean {
  return batch?.channels.some((channel) => isAccessGiven(channel) && (channel.status === 'Draft' || channel.status === 'AwaitingChannelAccess')) ?? false;
}

/** The accommodation ids of the listings whose last operation has an unknown result: the host checks the panel and asks again by naming them. */
export function unknownResultItems(channel: ExistingInventoryChannel): ExistingInventoryItem[] {
  return channel.items.filter((item) => item.errorCode === 'd6_result_unknown');
}

/** True when the batch has reached the mapping on every channel whose access is given (some channel waits for the host, none is still importing). */
export function isAtMapping(batch: ExistingInventoryBatch | undefined): boolean {
  if (!batch || isImporting(batch)) return false;
  return batch.channels.some((channel) => channel.status === 'AwaitingMapping');
}

/** The listings of a batch by channel code, for a channel that was asked for and has no row yet. */
export function channelOf(batch: ExistingInventoryBatch | undefined, channelCode: string): ExistingInventoryChannel | undefined {
  return batch?.channels.find((channel) => channel.channelCode === channelCode);
}

/** The channel codes of the batch, in the order the server gave them. */
export function batchChannelCodes(batch: ExistingInventoryBatch | undefined): string[] {
  return batch?.channels.map((channel) => channel.channelCode) ?? [];
}
