import { describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import { fiscalTermState, fiscalTermText } from '../long-rent-fiscal-format';

const TODAY = '2026-11-01';

describe('fiscal report: the period of a lease', () => {
  it('fiscalTermState_EndBeforeToday_IsEnded', () => {
    expect(fiscalTermState({ currentTermEndDate: '2026-10-31' }, TODAY)).toBe('ended');
  });

  it('fiscalTermState_EndToday_IsEndsToday', () => {
    expect(fiscalTermState({ currentTermEndDate: '2026-11-01' }, TODAY)).toBe('endsToday');
  });

  it('fiscalTermState_EndAfterToday_IsRunning', () => {
    expect(fiscalTermState({ currentTermEndDate: '2029-10-31' }, TODAY)).toBe('running');
  });

  it('fiscalTermState_UnreadableDate_IsRunning', () => {
    expect(fiscalTermState({ currentTermEndDate: 'not a date' }, TODAY)).toBe('running');
  });

  it('fiscalTermText_TwoLeasesOfOneTenantOnOneProperty_TellsThemApart', () => {
    const t = i18n.getFixedT('it');
    // The lease ended early on the day it started, and the one that replaced it: two rows that used to look the same.
    const ended = { startDate: '2026-11-01', currentTermEndDate: '2026-11-01' };
    const running = { startDate: '2026-11-01', currentTermEndDate: '2029-10-31' };

    expect(fiscalTermText(ended, 'it', t, TODAY)).toBe('dal 1 nov 2026 al 1 nov 2026 · termina oggi');
    expect(fiscalTermText(running, 'it', t, TODAY)).toBe('dal 1 nov 2026 al 31 ott 2029');
  });

  it('fiscalTermText_PeriodAlreadyOver_SaysSo', () => {
    const t = i18n.getFixedT('it');

    expect(fiscalTermText({ startDate: '2025-03-01', currentTermEndDate: '2026-02-28' }, 'it', t, TODAY)).toBe(
      'dal 1 mar 2025 al 28 feb 2026 · concluso',
    );
  });

  it('fiscalTermText_English_FollowsTheLanguage', () => {
    const t = i18n.getFixedT('en');

    expect(fiscalTermText({ startDate: '2026-11-01', currentTermEndDate: '2029-10-31' }, 'en', t, TODAY)).toBe(
      'from Nov 1, 2026 to Oct 31, 2029',
    );
  });

  it('fiscalTermText_NoReadableDate_IsEmpty', () => {
    const t = i18n.getFixedT('it');

    expect(fiscalTermText({ startDate: '', currentTermEndDate: '2026-11-01' }, 'it', t, TODAY)).toBe('');
  });
});
