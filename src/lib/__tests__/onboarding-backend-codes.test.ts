import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import {
  ONBOARDING_FLOW_ACTIONS,
  ONBOARDING_FLOW_REASONS,
  ONBOARDING_PART_REASONS,
  ONBOARDING_PREREQUISITE_KEYS,
} from '@/types/onboarding.types';
import { flowReasonKey, prerequisiteKey } from '../onboarding-flows';
import { launchTargetForAction, resolveLaunchTarget } from '../onboarding-part-launch';
import { isOnboardingPartReason, reasonKey } from '../onboarding-parts';

/**
 * The codes the backend sends (E10/F01/US04/T01, backend `develop`: `OnboardingFlowModels.cs` and `OnboardingPlanModels.cs`), copied as they stand there. The list
 * is the contract: a code the backend adds must be added here AND in the app (types, texts, launcher), or this test says which one is missing. A code the backend
 * sends that the app has no text for would be shown as a bare key, which is what these tests keep from happening.
 */
const BACKEND_FLOW_REASONS = [
  'connection_missing',
  'connection_lost',
  'mapping_unconfirmed',
  'mapping_unavailable',
  'sender_missing',
  'channel_content_to_fix',
  'cin_missing_or_invalid',
  'tax_rate_missing',
  'message_sync_not_ready',
  'issuer_missing',
  'no_bookings_yet',
  'flow_not_activated',
  'property_long_rent',
  'property_inactive',
  'content_managed_on_channel',
  'chat_not_licensed',
  'accountant_handles',
  'not_provided',
];

const BACKEND_FLOW_ACTIONS = ['connect', 'reconnect', 'confirmMapping', 'chooseSender', 'fixListing', 'enterCin', 'enterTaxRate', 'activate', 'chooseIssuer'];

const BACKEND_PREREQUISITE_KEYS = ['connection', 'mapping', 'singleSender', 'content', 'cin', 'taxRate', 'messageSync', 'issuer', 'bookings'];

const BACKEND_PART_REASONS = [
  'inventory_scenario_missing',
  'existing_ota_import_incomplete',
  'connection_missing',
  'connection_lost',
  'mapping_unavailable',
  'mapping_unconfirmed',
  'channels_missing',
  'channel_content_to_fix',
  'price_missing',
  'sender_missing',
  'cin_missing_or_invalid',
  'tax_rate_missing',
  'identification_off',
  'access_code_missing',
  'flows_incomplete',
  'notification_preferences_missing',
  'assistant_situation_missing',
  'issuer_missing',
  'accountant_handles',
  'partner_integration_missing',
  'connector_off',
  'no_property',
  'required_part_not_done',
  'not_provided',
];

const LANGUAGES = ['it', 'en'] as const;

/** The text of a key in a language, and nothing else: a key with no text answers with the key, and a text that still holds `onboardingPlan.` is a bare key. */
function textIn(language: (typeof LANGUAGES)[number], key: string): string {
  return i18n.getFixedT(language)(key);
}

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

describe('the codes of the onboarding the backend sends (E10/F01/US04/T01) all have their text', () => {
  it('OnboardingCodes_EveryFlowReasonOfTheBackend_IsKnownAndHasATextInBothLanguages', () => {
    for (const code of BACKEND_FLOW_REASONS) {
      expect(ONBOARDING_FLOW_REASONS as readonly string[], code).toContain(code);
      expect(flowReasonKey(code), code).toBe(`onboardingPlan.reasons.property.${code}`);
      for (const language of LANGUAGES) {
        expect(i18n.exists(flowReasonKey(code), { lng: language }), `${code} (${language})`).toBe(true);
        expect(textIn(language, flowReasonKey(code)), `${code} (${language})`).not.toContain('onboardingPlan.');
      }
    }
    // The app knows no flow reason the backend does not send: a code is never kept after the backend drops it.
    expect([...ONBOARDING_FLOW_REASONS].sort()).toEqual([...BACKEND_FLOW_REASONS].sort());
  });

  it('OnboardingCodes_EveryPartReasonOfTheBackend_IsKnownAndHasATextInBothLanguages', () => {
    for (const code of BACKEND_PART_REASONS) {
      expect(ONBOARDING_PART_REASONS as readonly string[], code).toContain(code);
      expect(isOnboardingPartReason(code), code).toBe(true);
      for (const language of LANGUAGES) {
        expect(i18n.exists(reasonKey(code as (typeof ONBOARDING_PART_REASONS)[number]), { lng: language }), `${code} (${language})`).toBe(true);
        expect(textIn(language, reasonKey(code as (typeof ONBOARDING_PART_REASONS)[number])), `${code} (${language})`).not.toContain('onboardingPlan.');
      }
    }
    expect([...ONBOARDING_PART_REASONS].sort()).toEqual([...BACKEND_PART_REASONS].sort());
  });

  it('OnboardingCodes_EveryPrerequisiteKeyOfTheBackend_IsKnownAndHasATextInBothLanguages', () => {
    for (const key of BACKEND_PREREQUISITE_KEYS) {
      expect(ONBOARDING_PREREQUISITE_KEYS as readonly string[], key).toContain(key);
      expect(prerequisiteKey(key), key).toBe(`onboardingPlan.summary.prerequisites.${key}`);
      for (const language of LANGUAGES) {
        expect(i18n.exists(prerequisiteKey(key), { lng: language }), `${key} (${language})`).toBe(true);
        expect(textIn(language, prerequisiteKey(key)), `${key} (${language})`).not.toContain('onboardingPlan.');
      }
    }
    expect([...ONBOARDING_PREREQUISITE_KEYS].sort()).toEqual([...BACKEND_PREREQUISITE_KEYS].sort());
  });

  it('OnboardingCodes_EveryActionOfTheBackend_IsKnownAndOpensAPage_ChooseIssuerOpensTheFiscalWizard', () => {
    expect([...ONBOARDING_FLOW_ACTIONS].sort()).toEqual([...BACKEND_FLOW_ACTIONS].sort());
    for (const action of BACKEND_FLOW_ACTIONS) {
      const launch = launchTargetForAction(action);
      expect(launch, action).not.toBeNull();
      // Every action leads to a page of the manifest the person may open, never to a dead end.
      expect(resolveLaunchTarget(launch!.target, launch!.focus ?? null)?.to, action).toEqual(expect.any(String));
    }
    expect(launchTargetForAction('chooseIssuer')).toEqual({ target: 'fiscal' });
    expect(resolveLaunchTarget('fiscal')?.to).toMatch(/^\/app\/short-rent\/fiscal\//);
  });
});

describe('a code the app does not know (the server is newer than the app) never reads as a key', () => {
  it('OnboardingCodes_UnknownFlowReason_ReadsAsTheNeutralLine', () => {
    for (const code of ['brand_new_reason', '', null, undefined, 'toString']) {
      expect(flowReasonKey(code)).toBe('onboardingPlan.reasons.property.unknown');
    }
    for (const language of LANGUAGES) {
      expect(textIn(language, flowReasonKey('brand_new_reason'))).not.toContain('onboardingPlan.');
    }
  });

  it('OnboardingCodes_UnknownPrerequisiteKey_ReadsAsTheNeutralPhraseInBothLanguages', () => {
    for (const key of ['brandNewKey', '', null, undefined, 'toString', 'constructor']) {
      expect(prerequisiteKey(key)).toBe('onboardingPlan.summary.prerequisites.unknown');
    }
    expect(textIn('it', prerequisiteKey('brandNewKey'))).toBe(`qualcos'altro`);
    expect(textIn('en', prerequisiteKey('brandNewKey'))).toBe('something else');
  });

  it('OnboardingCodes_UnknownAction_OpensNothingInsteadOfADeadLink', () => {
    expect(launchTargetForAction('brandNewAction')).toBeNull();
  });
});
