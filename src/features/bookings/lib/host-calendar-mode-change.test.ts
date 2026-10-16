import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { MANUAL_BLOCK_REASONS, MODE_CHANGE_BLOCK_REASON, type CalendarItemDto } from '@/types/calendar.types';
import { blockSourceLabel, toHostCalendarEvents, type HostCalendarBlockEvent } from './host-calendar';

/** The nights a scheduled change to long-term closes (PM-02): a manual block whose reason is `ModeChange`. */
function block(overrides: Partial<CalendarItemDto> = {}): CalendarItemDto {
  return {
    type: 'ical-block',
    id: 'mc1',
    propertyId: 'p1',
    startDate: '2026-11-30T00:00:00',
    endDate: '2028-12-01T00:00:00',
    startDateUtc: '2026-11-30T00:00:00Z',
    endDateUtc: '2028-12-01T00:00:00Z',
    summary: null,
    channel: null,
    feedLabel: null,
    blockSource: 'Manual',
    blockReason: 'ModeChange',
    feedId: null,
    bookingId: null,
    convertible: false,
    ...overrides,
  };
}

const only = (item: CalendarItemDto) => toHostCalendarEvents([item])[0] as HostCalendarBlockEvent;

describe('the block of a change of mode in the host calendar (PM-03)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('toHostCalendarEvents_ModeChangeBlock_KeepsItsOwnReasonInsteadOfOther', () => {
    const event = only(block());

    expect(event).toMatchObject({ kind: 'block', manual: true, reason: MODE_CHANGE_BLOCK_REASON, convertible: false });
  });

  it('toHostCalendarEvents_AnUnknownReasonIsStillOther_AndTheHostsReasonsAreUnchanged', () => {
    expect(only(block({ blockReason: 'Something' })).reason).toBe('Other');
    expect(only(block({ blockReason: 'Maintenance' })).reason).toBe('Maintenance');
    // The host cannot pick it: it is not one of the reasons of the form.
    expect(MANUAL_BLOCK_REASONS).not.toContain(MODE_CHANGE_BLOCK_REASON);
  });

  it('toHostCalendarEvents_AReasonOnAnImportedBlock_IsIgnored', () => {
    expect(only(block({ blockSource: 'ICalImport', blockReason: 'ModeChange', channel: 'Airbnb' })).reason).toBeNull();
  });

  it('blockSourceLabel_ModeChange_HasItsOwnLabelInBothLanguages', async () => {
    const event = only(block());

    expect(blockSourceLabel(event, i18n.getFixedT('it'))).toBe("Passaggio all'affitto lungo");
    expect(blockSourceLabel(event, i18n.getFixedT('en'))).toBe('Change to long-term rental');
    // The reasons of the host keep theirs.
    expect(blockSourceLabel(only(block({ blockReason: 'Owner' })), i18n.getFixedT('it'))).toBe('Soggiorno del proprietario');
  });
});
