import { describe, expect, it } from 'vitest';
import { buildBookingPath, buildInquiryPath, parseBookingParams } from '../booking-params';

describe('booking params: what the pages of the site tell the booking', () => {
  it('buildBookingPath_NothingKnown_IsThePlainBookingAddress', () => {
    expect(buildBookingPath('splendore-pulizie')).toBe('/fornitori/splendore-pulizie/prenota');
  });

  it('buildBookingPath_ThenParse_GivesBackWhatWasWritten', () => {
    const params = {
      service: 'pulizia-standard',
      quantity: 2,
      surface: 85,
      options: [
        { code: 'bagno-extra', quantity: 2 },
        { code: 'finestre', quantity: 1 },
      ],
      comune: '058091',
      day: '2026-11-03',
      start: '2026-11-03T08:00:00.000Z',
    };

    const path = buildBookingPath('splendore-pulizie', params);

    expect(path.startsWith('/fornitori/splendore-pulizie/prenota?')).toBe(true);
    expect(parseBookingParams(path.split('?')[1])).toEqual(params);
  });

  it('parseBookingParams_ValuesThatDoNotFit_AreIgnoredNeverAnError', () => {
    const parsed = parseBookingParams(
      'service=Not%20A%20Slug&quantity=-3&surface=abc&options=bad%20code:2,ok:0,fine:3,fine:4&comune=58091&day=2026-02-31&start=tomorrow',
    );

    // Only the second «fine» is dropped as a repeat; «ok:0» and the bad code do not fit.
    expect(parsed).toEqual({ options: [{ code: 'fine', quantity: 3 }] });
  });

  it('buildBookingPath_ValuesThatDoNotFit_AreNotWritten', () => {
    const path = buildBookingPath('splendore-pulizie', { service: 'Bad Slug', quantity: 0, comune: 'Roma', day: 'domani' });

    expect(path).toBe('/fornitori/splendore-pulizie/prenota');
  });

  it('buildInquiryPath_CarriesOnlyTheServiceAndTheComune', () => {
    expect(buildInquiryPath('splendore-pulizie', { service: 'pulizia-standard', comune: '058091' })).toBe(
      '/fornitori/splendore-pulizie/preventivo?service=pulizia-standard&comune=058091',
    );
    expect(buildInquiryPath('splendore-pulizie')).toBe('/fornitori/splendore-pulizie/preventivo');
  });
});
