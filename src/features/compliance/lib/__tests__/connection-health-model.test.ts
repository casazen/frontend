import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RouteManifestEntry } from '@/config/route-manifest';
import i18n from '@/i18n/config';
import type { ConnectionHealthLine } from '@/types';
import { describeHealthLine, formatRunTime, healthDetailKey, healthInstructionsKey, senderWizardPath, SENDER_WIZARD_PATH } from '../connection-health-model';

// The wizard of the sender (E03/F01/US02/T02) is another task: whether its route is in the ROUTE_MANIFEST is decided here, not by the day it lands.
const manifest = vi.hoisted(() => ({ entry: undefined as unknown }));
vi.mock('@/config/route-manifest', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/config/route-manifest')>()),
  getManifestEntry: () => manifest.entry,
}));

const line = (change: Partial<ConnectionHealthLine>): ConnectionHealthLine => ({
  sender: 'ChannelManager',
  state: 'Active',
  connectionValid: true,
  autorun: true,
  lastAutomaticRunAt: '2026-10-12T12:05:00Z',
  reason: null,
  declaredAt: null,
  ...change,
});

describe('describeHealthLine', () => {
  it('describeHealthLine_ActiveChannelManager_IsActiveWithItsLastRun', () => {
    const view = describeHealthLine(line({}), true);

    expect(view).toMatchObject({ state: 'Active', sender: 'ChannelManager', needsAction: false, checkInChannelManager: false, lastRunAt: '2026-10-12T12:05:00Z' });
  });

  it.each([undefined, null, {} as ConnectionHealthLine, line({ state: 'Verified' as never }), line({ state: undefined as never })])(
    'describeHealthLine_%j_IsUnknownNeverActive',
    (value) => {
      // The client never works a green state out: what it cannot read is «Non verificabile».
      const view = describeHealthLine(value, true);

      expect(view.state).toBe('Unknown');
      expect(view.state).not.toBe('Active');
    },
  );

  it('describeHealthLine_OutsideItaly_IsManualWhateverTheLineSays', () => {
    expect(describeHealthLine(line({ state: 'Active' }), false).state).toBe('Manual');
  });

  it.each(['Inactive', 'Unknown'] as const)('describeHealthLine_%sChannelManager_AsksTheHostAndCanBeCheckedInTheChannelManager', (state) => {
    const view = describeHealthLine(line({ state }), true);

    expect(view.needsAction).toBe(true);
    expect(view.checkInChannelManager).toBe(true);
  });

  it('describeHealthLine_ManualSender_AsksNothingOfTheHostAndShowsNoRun', () => {
    const view = describeHealthLine(line({ sender: 'Manual', state: 'Manual' }), true);

    expect(view).toMatchObject({ needsAction: false, checkInChannelManager: false, lastRunAt: null });
  });

  it('describeHealthLine_CasaZenSender_NeverPointsAtTheChannelManager', () => {
    const view = describeHealthLine(line({ sender: 'CasaZen', state: 'Inactive', lastAutomaticRunAt: '2026-10-12T12:05:00Z' }), true);

    expect(view).toMatchObject({ needsAction: true, checkInChannelManager: false, lastRunAt: null });
  });

  it('describeHealthLine_ReasonCode_HasWordsOnlyWhenThisVersionKnowsIt', () => {
    expect(describeHealthLine(line({ state: 'Unknown', reason: 'octorate_police_not_exposed' }), true).reasonCode).toBe('octorate_police_not_exposed');
    // A code of a newer API, or a path-like text, is never shown raw.
    expect(describeHealthLine(line({ state: 'Unknown', reason: 'something_new' }), true).reasonCode).toBeNull();
    expect(describeHealthLine(line({ state: 'Unknown', reason: 'constructor' }), true).reasonCode).toBeNull();
  });

  it('describeHealthLine_UnknownSender_IsNoSenderAndAsksNothingOfTheHost', () => {
    const view = describeHealthLine(line({ sender: 'Somebody' as never, state: 'Inactive' }), true);

    expect(view.sender).toBeNull();
    expect(healthInstructionsKey(view)).toBeNull();
  });
});

describe('the words of a line', () => {
  const states = ['Active', 'Inactive', 'Unknown', 'Manual'] as const;
  const senders = ['ChannelManager', 'CasaZen', 'Manual', 'Other'] as const;

  it.each(['it', 'en'])('healthDetailKey_EveryStateAndSender_HasWordsInTheLanguage_%s', async (language) => {
    await i18n.changeLanguage(language);

    for (const state of states) {
      for (const sender of senders) {
        const view = describeHealthLine(line({ state, sender: sender as never }), true);
        const text = i18n.t(healthDetailKey(view));
        expect(text, `${state} ${sender}`).not.toMatch(/^connectionHealth\./);

        const instructions = healthInstructionsKey(view);
        if (instructions) expect(i18n.t(instructions), `${state} ${sender} instructions`).not.toMatch(/^connectionHealth\./);
      }
    }
  });

  it.each(['it', 'en'])('KnownReasonCodes_HaveWordsInTheLanguage_%s', async (language) => {
    await i18n.changeLanguage(language);
    const codes = [
      'connection_not_checked_yet',
      'credentials_refused',
      'octorate_not_connected',
      'octorate_police_account_invalid',
      'octorate_police_autorun_off',
      'octorate_police_not_exposed',
      'octorate_unavailable',
      'sender_casazen_not_available',
    ];

    for (const code of codes) {
      expect(describeHealthLine(line({ state: 'Unknown', reason: code }), true).reasonCode).toBe(code);
      expect(i18n.t(`connectionHealth.reason.${code}`)).not.toMatch(/^connectionHealth\./);
    }
  });

  it('InstructionsOfAnInactiveSend_DoNotNameTheSupplier', async () => {
    await i18n.changeLanguage('it');
    const text = i18n.t('connectionHealth.instructions.ChannelManager.Inactive') + i18n.t('connectionHealth.detail.Inactive.ChannelManager');

    // «il tuo channel manager»: the name of the supplier is only in the closed disclosure (UX-12).
    expect(text).not.toMatch(/octorate/i);
    expect(i18n.t('connectionHealth.disclosureTitle')).toBe('Dati consultati su Octorate');
  });
});

describe('senderWizardPath', () => {
  const everything = () => true;
  const wizard = { path: SENDER_WIZARD_PATH, context: 'short-rent', requiredPermissions: ['property.write'] } as unknown as RouteManifestEntry;

  beforeEach(() => {
    manifest.entry = undefined;
  });

  it('senderWizardPath_WizardNotInTheManifest_IsNullSoThePanelShowsTheInstructions', () => {
    expect(senderWizardPath('p1', everything)).toBeNull();
  });

  it('senderWizardPath_WizardInTheManifest_IsItsAddressWithTheProperty', () => {
    manifest.entry = wizard;

    expect(senderWizardPath('p1', everything)).toBe(`${SENDER_WIZARD_PATH}?property=p1`);
  });

  it('senderWizardPath_PersonWhoMayNotOpenTheWizard_IsNullNeverADeadButton', () => {
    manifest.entry = wizard;

    expect(senderWizardPath('p1', (_context, permission) => permission !== 'property.write')).toBeNull();
  });
});

describe('formatRunTime', () => {
  it('formatRunTime_AnInstant_IsToldInTheTimeZoneOfTheProperty', () => {
    // 12:05 UTC on 12 October is 14:05 in Rome (summer time) and 08:05 in New York.
    expect(formatRunTime('2026-10-12T12:05:00Z', 'it', 'Europe/Rome')).toContain('14:05');
    expect(formatRunTime('2026-10-12T12:05:00Z', 'it', 'America/New_York')).toContain('08:05');
  });

  it('formatRunTime_NoTimeZoneOrOneTheBrowserDoesNotKnow_IsRome', () => {
    expect(formatRunTime('2026-10-12T12:05:00Z', 'it', undefined)).toContain('14:05');
    expect(formatRunTime('2026-10-12T12:05:00Z', 'it', 'Mars/Olympus')).toContain('14:05');
  });

  it('formatRunTime_NotAnInstant_IsEmpty', () => {
    expect(formatRunTime('yesterday', 'it', 'Europe/Rome')).toBe('');
  });
});
