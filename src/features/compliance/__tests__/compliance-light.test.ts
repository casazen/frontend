import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '@/i18n/config';
import { COMPLIANCE_REASON_CODES, type ComplianceSummaryItem, type ComplianceSummaryResult } from '@/types/compliance.types';
import { LIGHT_RANK, lightStateOf, reasonText, summarizeLights } from '../lib/compliance-light';

const t = i18n.getFixedT('it') as TFunction;
const exists = (key: string) => i18n.exists(key);

const item = (parts: Partial<ComplianceSummaryItem> & { id: string }): ComplianceSummaryItem => ({
  label: 'Mario Rossi',
  action: 'UploadAlloggiatiReceipt',
  propertyId: null,
  bookingId: parts.id,
  ...parts,
});

const empty = { count: 0, items: [] };

describe('lightStateOf (the client never works a light out)', () => {
  it.each([
    ['Green', 'green'],
    ['Yellow', 'yellow'],
    ['Red', 'red'],
  ] as const)('lightStateOf_%s_IsTheLightTheApiSent', (light, state) => {
    expect(lightStateOf(light)).toBe(state);
  });

  it.each([undefined, null, '', 'green', 'GREEN', 'Blue', 'toString', 'constructor', '__proto__', 1, 2, 3, true, {}, []])(
    'lightStateOf_%j_IsToVerifyNeverGreen',
    (value) => {
      expect(lightStateOf(value)).toBe('unknown');
    },
  );

  it('lightRank_WhatNobodyCouldSay_ComesBeforeWhatIsInOrder', () => {
    // An item with no light is not green: it must never sort among the ones that are in order.
    expect(LIGHT_RANK.red).toBeLessThan(LIGHT_RANK.yellow);
    expect(LIGHT_RANK.yellow).toBeLessThan(LIGHT_RANK.unknown);
    expect(LIGHT_RANK.unknown).toBeLessThan(LIGHT_RANK.green);
  });
});

describe('reasonText (plain words, never the raw code)', () => {
  it('reasonText_KnownCode_IsTranslated', () => {
    expect(reasonText('awaiting_receipt', 'yellow', { t, exists })).toBe('È stato inviato: manca la ricevuta da archiviare.');
    expect(reasonText('entrusted_to_channel_manager', 'yellow', { t, exists })).toContain('channel manager');
  });

  it('reasonText_CodeThisVersionDoesNotKnow_IsTheGenericTextOfTheLight', () => {
    const text = reasonText('brand_new_code_of_a_newer_server', 'red', { t, exists });

    expect(text).toBe("C'è qualcosa da fare.");
    expect(text).not.toContain('brand_new_code');
  });

  it.each(['a.b', 'compliance.light', 'Receipt', 'constructor', 'x y', '../x'])('reasonText_CodeThatCouldWalkTheTexts_%s_IsTheGenericText', (code) => {
    expect(reasonText(code, 'yellow', { t, exists })).toBe('È in corso: aspetta la conferma.');
  });

  it('reasonText_NoCodeAndNoLight_SaysNothing', () => {
    expect(reasonText(null, 'unknown', { t, exists })).toBeUndefined();
    expect(reasonText(undefined, 'unknown', { t, exists })).toBeUndefined();
  });

  it('reasonText_NoCodeButALight_IsTheGenericTextOfTheLight', () => {
    expect(reasonText(null, 'green', { t, exists })).toBe('È in regola.');
  });

  it.each(['it', 'en'] as const)('everyReasonCodeOfTheBackend_HasItsTextIn_%s', (lng) => {
    for (const code of COMPLIANCE_REASON_CODES) {
      expect(i18n.exists(`compliance.reason.${code}`, { lng }), `${lng}: compliance.reason.${code}`).toBe(true);
    }
    // And the generic words of every light, and the name of every light.
    for (const state of ['green', 'yellow', 'red', 'unknown']) {
      expect(i18n.exists(`compliance.light.${state}`, { lng })).toBe(true);
      expect(i18n.exists(`compliance.light.fallback.${state}`, { lng })).toBe(true);
    }
  });

  it('reasonTexts_NeverNameTheSupplierOfTheChannelManager', () => {
    for (const lng of ['it', 'en']) {
      const fixed = i18n.getFixedT(lng);
      for (const code of COMPLIANCE_REASON_CODES) expect(fixed(`compliance.reason.${code}`)).not.toMatch(/octorate/i);
    }
  });
});

describe('summarizeLights (what the lights say, counted from what the API sends)', () => {
  const summary = (parts: Partial<ComplianceSummaryResult>): ComplianceSummaryResult => ({
    propertiesPending: empty,
    guestCheckInsIncomplete: empty,
    checkoutsDue: empty,
    alloggiatiFailures: empty,
    alloggiatiManualRequired: empty,
    turnoversPending: empty,
    ...parts,
  });

  it('summarizeLights_RedYellowGreenAndNoLight_CountsEachAndTheOnesThatNeedAttention', () => {
    const lights = summarizeLights(
      summary({
        receiptsToUpload: {
          count: 3,
          items: [item({ id: 'a', light: 'Red' }), item({ id: 'b', light: 'Yellow' }), item({ id: 'c', light: 'Green' }), item({ id: 'd', light: 'Yellow' })],
        },
        alloggiatiManualRequired: { count: 1, items: [item({ id: 'e', action: 'SendAlloggiati' })] },
      }),
    );

    expect(lights).toMatchObject({ red: 1, yellow: 2, green: 1, unknown: 1, needs: 4, unlisted: 0, lightsOn: true });
  });

  it('summarizeLights_ServerCountsMoreThanItLists_KeepsTheRestAsNotListedAndNeverAsGreen', () => {
    const lights = summarizeLights(summary({ manualSendsRequired: { count: 60, items: [item({ id: 'a', light: 'Red' }), item({ id: 'b', light: 'Green' })] } }));

    // 60 need attention, 1 of them is listed (red); the green one listed is not one of them.
    expect(lights.needs).toBe(60);
    expect(lights.unlisted).toBe(59);
    expect(lights.green).toBe(1);
  });

  it('summarizeLights_OnlyGreen_NothingNeedsAttention', () => {
    const lights = summarizeLights(summary({ receiptsToUpload: { count: 0, items: [item({ id: 'a', light: 'Green' })] } }));

    expect(lights.needs).toBe(0);
    expect(lights.green).toBe(1);
  });

  it('summarizeLights_NoLightAnywhere_IsALegacyPayloadAndEveryItemIsToVerify', () => {
    const lights = summarizeLights(summary({ checkoutsDue: { count: 2, items: [item({ id: 'a', action: 'CheckOut' }), item({ id: 'b', action: 'CheckOut' })] } }));

    expect(lights).toMatchObject({ unknown: 2, needs: 2, green: 0, lightsOn: false });
  });

  it.each([undefined, null, {}, '<!doctype html>' as never, { receiptsToUpload: 'x' as never }, { periodItems: { count: 'many', items: 'none' } as never }])(
    'summarizeLights_PartialOrOddPayload_%j_NeverThrowsAndCountsNothing',
    (payload) => {
      expect(summarizeLights(payload)).toMatchObject({ needs: 0, red: 0, yellow: 0, unknown: 0, green: 0, lightsOn: false });
    },
  );
});
