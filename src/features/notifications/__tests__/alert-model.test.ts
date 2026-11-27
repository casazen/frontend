import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';
import { ALERT_TYPES, type PendingAlert } from '@/types/alert';
import { alertRoute, alertTypeKey, orderAlerts, REMIND_CHOICES, remindAtFor, remindOptions, upsertAlert } from '../alert-model';

const alert = (alertId: string, urgency: PendingAlert['urgency'] = 'Normal'): PendingAlert => ({
  alertId,
  alertType: 'ComplianceIssue',
  entityType: 'Booking',
  entityId: `entity-${alertId}`,
  urgency,
});

const ids = (alerts: readonly PendingAlert[]) => alerts.map((item) => item.alertId);

describe('orderAlerts', () => {
  it('orderAlerts_MixedUrgencies_PutsTheMostUrgentFirstAndKeepsTheOrderOfArrivalWithinOne', () => {
    const queue = [alert('n1'), alert('l1', 'Low'), alert('h1', 'High'), alert('n2'), alert('h2', 'High')];

    expect(ids(orderAlerts(queue))).toEqual(['h1', 'h2', 'n1', 'n2', 'l1']);
    // The list it was given is left as it was.
    expect(ids(queue)).toEqual(['n1', 'l1', 'h1', 'n2', 'h2']);
  });

  it('orderAlerts_NoAlerts_IsEmpty', () => {
    expect(orderAlerts([])).toEqual([]);
  });
});

describe('upsertAlert', () => {
  it('upsertAlert_NewAlert_GoesAtTheEnd', () => {
    expect(ids(upsertAlert([alert('a1')], alert('a2')))).toEqual(['a1', 'a2']);
  });

  it('upsertAlert_AlertAlreadyInTheQueue_ReplacesItInPlaceInsteadOfDoublingIt', () => {
    const queue = [alert('a1', 'Low'), alert('a2', 'Low')];

    const result = upsertAlert(queue, alert('a1', 'High'));

    expect(ids(result)).toEqual(['a1', 'a2']);
    expect(result[0].urgency).toBe('High');
    expect(queue[0].urgency).toBe('Low');
  });
});

describe('alertRoute', () => {
  it.each([
    ['Booking', 'b-1', '/app/short-rent/bookings/b-1'],
    ['Property', 'p-1', '/app/short-rent/properties/p-1'],
    ['booking', 'b 2', '/app/short-rent/bookings/b%202'],
  ])('alertRoute_%s%s_OpensThePageOfTheEntity', (entityType, entityId, expected) => {
    expect(alertRoute({ entityType, entityId })).toBe(expected);
  });

  it('alertRoute_EntityTheAppHasNoPageFor_GoesNowhere', () => {
    expect(alertRoute({ entityType: 'OtaConnection', entityId: 'c-1' })).toBeNull();
  });
});

describe('alertTypeKey', () => {
  it('alertTypeKey_KnownType_IsItsOwnSentence', () => {
    expect(alertTypeKey('IstatDeadline')).toBe('alert.popup.type.IstatDeadline');
  });

  it('alertTypeKey_TypeTheAppDoesNotKnow_IsTheGenericSentence', () => {
    expect(alertTypeKey('SomethingNew')).toBe('alert.popup.type.generic');
  });
});

function textAt(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), tree);
}

describe('texts of the popup alerts', () => {
  it.each([
    ['it', it_],
    ['en', en],
  ])('locale_%s_HasASentenceForEveryAlertTypeAndEveryChoiceOfTheDialog', (_language, tree) => {
    const keys = [
      ...ALERT_TYPES.map((type) => alertTypeKey(type)),
      alertTypeKey('SomethingNew'),
      ...REMIND_CHOICES.map((choice) => `alert.remindMeLater.${choice}`),
      'alert.remindMeLater.title',
      'alert.remindMeLater.description',
      'alert.remindMeLater.pastDeadline',
      'alert.popup.doNow',
      'alert.popup.dismiss',
      'alert.popup.remindMeLater',
      'alert.popup.dismissError',
      'alert.popup.remindError',
    ];

    const missing = keys.filter((key) => typeof textAt(tree, key) !== 'string' || textAt(tree, key) === '');

    expect(missing).toEqual([]);
  });
});

describe('remindAtFor', () => {
  const summer = new Date('2026-07-15T10:00:00.000Z'); // 12:00 in Rome

  it('remindAtFor_RelativeChoices_AddTheirDelayToNow', () => {
    expect(remindAtFor('15min', summer)?.toISOString()).toBe('2026-07-15T10:15:00.000Z');
    expect(remindAtFor('1hour', summer)?.toISOString()).toBe('2026-07-15T11:00:00.000Z');
    expect(remindAtFor('4hours', summer)?.toISOString()).toBe('2026-07-15T14:00:00.000Z');
  });

  it.each([
    ['in summer time (UTC+2)', '2026-07-15T10:00:00.000Z', '2026-07-16T07:00:00.000Z'],
    ['in winter time (UTC+1)', '2026-01-15T10:00:00.000Z', '2026-01-16T08:00:00.000Z'],
    // 23:30 UTC on the 15th is 00:30 on the 16th in Rome: tomorrow is the 17th, not the 16th.
    ['late in the evening in UTC, already the next day in Rome', '2026-01-15T23:30:00.000Z', '2026-01-17T08:00:00.000Z'],
    // Summer time starts on Sunday 29 March 2026 and ends on Sunday 25 October 2026.
    ['the day before summer time starts', '2026-03-28T10:00:00.000Z', '2026-03-29T07:00:00.000Z'],
    ['the day before summer time ends', '2026-10-24T10:00:00.000Z', '2026-10-25T08:00:00.000Z'],
  ])('remindAtFor_Tomorrow_%s_IsNineOnTheClockOfRome', (_when, now, expected) => {
    expect(remindAtFor('tomorrow', new Date(now))?.toISOString()).toBe(expected);
  });
});

describe('remindOptions', () => {
  const now = new Date('2026-07-15T10:00:00.000Z');
  const state = (deadline?: Date) => remindOptions(now, deadline).map(({ choice, disabled }) => [choice, disabled]);

  it('remindOptions_NoDeadline_OffersTheFourChoicesAllOn', () => {
    expect(state()).toEqual([
      ['15min', false],
      ['1hour', false],
      ['4hours', false],
      ['tomorrow', false],
    ]);
  });

  it('remindOptions_DeadlineInTwoHours_TurnsOffWhatFallsAfterIt', () => {
    expect(state(new Date('2026-07-15T12:00:00.000Z'))).toEqual([
      ['15min', false],
      ['1hour', false],
      ['4hours', true],
      ['tomorrow', true],
    ]);
  });

  it('remindOptions_DeadlineExactlyAtAChoice_KeepsThatChoiceOn', () => {
    // The server accepts a moment up to the deadline included (ADR-025-R10: RemindAt <= Deadline).
    expect(state(new Date('2026-07-15T11:00:00.000Z'))).toEqual([
      ['15min', false],
      ['1hour', false],
      ['4hours', true],
      ['tomorrow', true],
    ]);
  });

  it('remindOptions_DeadlineAlreadyPassed_TurnsEveryChoiceOff', () => {
    expect(state(new Date('2026-07-15T09:00:00.000Z')).every(([, disabled]) => disabled === true)).toBe(true);
  });
});
