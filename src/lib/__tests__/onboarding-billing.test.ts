import { beforeEach, describe, expect, it } from 'vitest';
import { BILLING_SETUP_PATH, BILLING_STEP_ORDER } from '@/features/fiscal/billing-wizard/billing-wizard-ids';
import i18n from '@/i18n/config';
import { BILLING_SETUP_ITEM_KEYS, BILLING_SETUP_SECTIONS } from '@/types/billing-setup.types';
import { BILLING_ITEM_STEPS, BILLING_SECTION_STEPS, billingItemTextKey, billingStepOfItem, billingStepOfReason, isBillingItemKey } from '../onboarding-billing';
import { resolveLaunchTarget } from '../onboarding-part-launch';

/**
 * The keys of the items the backend sends in `GET api/billing-setup` (E11/F01/US01/T04 `BillingSetupItemKeys`, E13/F01/US02/T03 `OwnerBillingSetupItemKeys`, backend `develop`),
 * copied as they stand there. The list is the contract: a key the backend adds must be added here AND in the table of the steps (`BILLING_ITEM_STEPS`) and in the texts, or this test
 * says which one is missing. An item with no step would be a part of the guide that opens nowhere, which is what this test keeps from happening.
 */
const BACKEND_ITEM_KEYS = [
  'country_missing',
  'legal_name_missing',
  'address_missing',
  'vat_number_missing',
  'fiscal_code_missing',
  'swiss_uid_missing',
  'regime_missing',
  'regime_code_missing',
  'tax_rule_missing',
  'guest_series_unconfirmed',
  'owner_series_unconfirmed',
  'tourist_tax_channels_unconfirmed',
  'auto_issue_unconfirmed',
  'conservation_agreement_unconfirmed',
  'stamp_duty_unconfirmed',
  'channel_commissions_unconfirmed',
  'owners_without_mandate',
];

/** The sections the backend sends (`BillingSetupSections`). */
const BACKEND_SECTIONS = ['issuer', 'vat', 'numbering', 'touristTax', 'channels', 'mandates', 'automation', 'italy'];

const LANGUAGES = ['it', 'en'] as const;

beforeEach(async () => {
  await i18n.changeLanguage('it');
});

describe('the part «Fatturazione» of the guide opens its wizard at the step of the item that is missing (E11/F02/US01/T02)', () => {
  it('BillingItemSteps_EveryItemKeyOfTheBackend_HasAStepOfTheWizardAndTheTableHasNoOther', () => {
    for (const key of BACKEND_ITEM_KEYS) {
      expect(isBillingItemKey(key), key).toBe(true);
      expect(BILLING_STEP_ORDER, key).toContain(BILLING_ITEM_STEPS[key as keyof typeof BILLING_ITEM_STEPS]);
    }
    // The table and the list of the app are exactly the keys the backend sends: a key is never kept after the backend drops it, and never missing.
    expect(Object.keys(BILLING_ITEM_STEPS).sort()).toEqual([...BACKEND_ITEM_KEYS].sort());
    expect([...BILLING_SETUP_ITEM_KEYS].sort()).toEqual([...BACKEND_ITEM_KEYS].sort());
  });

  it('BillingItemSteps_EverySectionOfTheBackend_HasAStep', () => {
    expect([...BILLING_SETUP_SECTIONS].sort()).toEqual([...BACKEND_SECTIONS].sort());
    for (const section of BACKEND_SECTIONS) expect(BILLING_STEP_ORDER, section).toContain(BILLING_SECTION_STEPS[section as keyof typeof BILLING_SECTION_STEPS]);
  });

  it('BillingItemSteps_AnUnknownKey_HasNoStepOfItsOwnAndIsNeverAKnownOne', () => {
    for (const key of ['brand_new_item', '', null, undefined, 42, 'toString', 'constructor', '__proto__']) {
      expect(isBillingItemKey(key), String(key)).toBe(false);
      expect(billingStepOfReason(key), String(key)).toBeNull();
      expect(billingStepOfItem({ key }), String(key)).toBeNull();
      expect(billingItemTextKey(key), String(key)).toBe('billingWizard.items.unknown');
    }
    // An item the app does not know yet (an epic added it) is still opened, by the section it says it belongs to.
    expect(billingStepOfItem({ key: 'brand_new_item', section: 'italy' })).toBe(BILLING_SECTION_STEPS.italy);
    expect(billingStepOfItem({ key: 'brand_new_item', section: 'nobody' })).toBeNull();
    // The reason of a part that is not about an item (the issuance is off) is not an item.
    expect(billingStepOfReason('issuer_missing')).toBeNull();
  });

  it.each(LANGUAGES)('BillingItemSteps_EveryItemKeyOfTheBackend_HasATextInPlainWordsIn_%s', async (language) => {
    await i18n.changeLanguage(language);
    for (const key of BACKEND_ITEM_KEYS) {
      const textKey = billingItemTextKey(key);
      expect(i18n.exists(textKey), key).toBe(true);
      // The text is not the key it came from, and a plural has its forms.
      expect(i18n.t(textKey), key).not.toBe(textKey);
      expect(i18n.t(textKey), key).not.toContain('billingWizard.');
    }
    expect(i18n.t(billingItemTextKey('owners_without_mandate'), { count: 1 })).not.toBe(i18n.t(billingItemTextKey('owners_without_mandate'), { count: 3 }));
    expect(i18n.t(billingItemTextKey('brand_new_item'))).not.toContain('billingWizard.');
  });

  it('BillingItemSteps_TheLaunchOfThePart_OpensTheWizardAtTheStepOfTheReasonAndOnlyAtThatOne', () => {
    for (const key of BACKEND_ITEM_KEYS) {
      const step = BILLING_ITEM_STEPS[key as keyof typeof BILLING_ITEM_STEPS];
      expect(resolveLaunchTarget('fiscal', null, null, undefined, key)?.to, key).toBe(`${BILLING_SETUP_PATH}?step=${step}`);
    }
    // No reason, a reason that is not an item and a key the app does not know: the wizard opens where it would without a step (at what is missing), never at a wrong one.
    for (const reason of [null, undefined, '', 'issuer_missing', 'brand_new_item']) {
      expect(resolveLaunchTarget('fiscal', null, null, undefined, reason)?.to, String(reason)).toBe(BILLING_SETUP_PATH);
    }
    // The reason of another part never gives the wizard a step.
    expect(resolveLaunchTarget('messages', null, null, undefined, 'regime_missing')?.to).toBe('/app/short-rent/messages');
  });
});
