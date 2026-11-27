import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import {
  GUEST_REGISTRATION_CERTAINTIES,
  GUEST_REGISTRATION_CHANNELS,
  GUEST_REGISTRATION_DEADLINE_KINDS,
  GUEST_REGISTRATION_DUTIES,
  GUEST_REGISTRATION_MISSING_CODES,
  GUEST_REGISTRATION_OBLIGATIONS,
  GUEST_REGISTRATION_PRIVATE_RENTALS,
} from '@/types/guest-registration.types';
import { regime } from '../../components/__tests__/guest-registration-fixtures';
import { DUTY_ANSWERS, certaintyView, isMissingCode, isTicinoRegime, missingCodesOf, missingTextKey, portalLink, regimeFacts } from '../guest-registration-model';

const it_ = i18n.getFixedT('it');
const en = i18n.getFixedT('en');

describe('the model of the card of the regime of the registration of the guests (E29/F02/US02/T01)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  describe('regimeFacts', () => {
    it('regimeFacts_RegimeOfTicino_SaysWhatTheCantonAsksWhenAndHowLongInAFewWordsEach', () => {
      const facts = regimeFacts(regime(), it_);

      expect(facts.obligation).toBe(it_('guestRegistration.short.obligation.ReportToAuthority'));
      expect(facts.deadline).toBe(it_('guestRegistration.deadline.Hours24FromArrival'));
      expect(facts.deadlineNote).toBeNull();
      expect(facts.retention).toBe('5 anni');
      expect(facts.channel).toBe(it_('guestRegistration.short.channel.PortalFileUpload'));
      expect(Object.keys(facts).sort()).toEqual(['channel', 'deadline', 'deadlineNote', 'obligation', 'retention']);
    });

    it('regimeFacts_ARuleThatDoesNotCoverPrivateHomesInFull_SaysSoAfterTheObligation', () => {
      for (const privateRentals of ['Partial', 'No', 'Unknown'] as const) {
        expect(regimeFacts(regime({ privateRentals }), it_).obligation, privateRentals).toBe(
          `${it_('guestRegistration.short.obligation.ReportToAuthority')} · ${it_(`guestRegistration.short.privateRentals.${privateRentals}`)}`,
        );
      }
    });

    it('regimeFacts_OneYearAndNoPeriod_AreToldInTheSingularAndAsTheSourcesNotSayingIt', () => {
      expect(regimeFacts(regime({ retentionYears: 1 }), it_).retention).toBe('1 anno');
      expect(regimeFacts(regime({ retentionYears: 1 }), en).retention).toBe('1 year');
      for (const years of [null, 0, -3, Number.NaN]) expect(regimeFacts(regime({ retentionYears: years }), it_).retention, String(years)).toBe(it_('guestRegistration.retention.none'));
    });

    it('regimeFacts_ANoteOfTheDeadline_IsKeptApartAndABlankOneIsNone', () => {
      expect(regimeFacts(regime({ deadlineNote: '  Entro le 02:00  ' }), it_).deadlineNote).toBe('Entro le 02:00');
      expect(regimeFacts(regime({ deadlineNote: '   ' }), it_).deadlineNote).toBeNull();
    });

    it('regimeFacts_AValueThisVersionDoesNotKnow_IsToCheckNeverTheRawValue', () => {
      const facts = regimeFacts(regime({ obligation: 'Mandatory' as never, privateRentals: 'Sometimes' as never, channel: 'Pigeon' as never, deadlineKind: 'Yearly' as never }), it_);

      for (const line of [facts.obligation, facts.deadline, facts.channel]) {
        expect(line).toContain(it_('guestRegistration.toVerify'));
        expect(line).not.toMatch(/Mandatory|Sometimes|Pigeon|Yearly|Magic/);
      }
    });
  });

  describe('certaintyView', () => {
    it('certaintyView_EveryCertainty_HasAWordASentenceThatSendsTheHostToCheckAndNeverTheToneOfAnAlarm', () => {
      for (const certainty of GUEST_REGISTRATION_CERTAINTIES) {
        const view = certaintyView(regime({ certainty }), it_, 'it');

        expect(view.certainty).toBe(certainty);
        expect(view.label).toBe(it_(`guestRegistration.certainty.${certainty}.label`));
        expect(view.text).toMatch(/verifica con il comune o la polizia/i);
        expect(view.text).toMatch(/consulenza legale/i);
        expect(['success', 'info', 'neutral']).toContain(view.tone);
      }
      expect(certaintyView(regime({ certainty: 'Verified' }), it_, 'it').tone).toBe('success');
      expect(certaintyView(regime({ certainty: 'Unverified' }), it_, 'it').tone).toBe('neutral');
    });

    it('certaintyView_TheDayTheEntryWasRead_IsWrittenInTheLanguageOfThePageWithoutShiftingTheDay', () => {
      expect(certaintyView(regime({ verifiedOn: '2026-11-20' }), it_, 'it').text).toContain('20 novembre 2026');
      expect(certaintyView(regime({ verifiedOn: '2026-11-20' }), en, 'en').text).toContain('November 20, 2026');
      // A date that is not one never prints «undefined» or an invalid date.
      expect(certaintyView(regime({ verifiedOn: 'soon' }), it_, 'it').text).not.toMatch(/undefined|Invalid/);
    });

    it('certaintyView_ACertaintyThisVersionDoesNotKnow_IsTheMostPrudentOne', () => {
      expect(certaintyView(regime({ certainty: 'Maybe' as never }), it_, 'it').certainty).toBe('Unverified');
    });
  });

  describe('what is missing', () => {
    it('missingCodesOf_ReasonsOfTheServer_AreKeptOnceEachInTheOrderGiven', () => {
      expect(missingCodesOf(['ticino_structure_id_missing', 'swiss_municipality_missing', 'ticino_structure_id_missing'])).toEqual(['ticino_structure_id_missing', 'swiss_municipality_missing']);
      expect(missingCodesOf(undefined)).toEqual([]);
      expect(missingCodesOf(null)).toEqual([]);
      expect(missingCodesOf([1, null, 'swiss_municipality_missing'] as unknown as string[])).toEqual(['swiss_municipality_missing']);
    });

    it('missingTextKey_KnownCodeAndUnknownCode_HaveATextInBothLanguagesNeverTheCode', () => {
      for (const code of GUEST_REGISTRATION_MISSING_CODES) {
        expect(isMissingCode(code)).toBe(true);
        expect(missingTextKey(code)).toBe(`guestRegistration.missing.${code}`);
        expect(i18n.exists(missingTextKey(code), { lng: 'it' })).toBe(true);
        expect(i18n.exists(missingTextKey(code), { lng: 'en' })).toBe(true);
      }
      expect(isMissingCode('something_new')).toBe(false);
      expect(missingTextKey('something_new')).toBe('guestRegistration.missing.unknown');
    });
  });

  describe('portalLink', () => {
    it('portalLink_HttpsAddress_IsALinkWithItsHost', () => {
      expect(portalLink('https://www.notifiche.ti.ch/portale')).toEqual({ href: 'https://www.notifiche.ti.ch/portale', host: 'www.notifiche.ti.ch' });
      expect(portalLink('  https://gast.sh.ch  ')).toEqual({ href: 'https://gast.sh.ch/', host: 'gast.sh.ch' });
    });

    it('portalLink_AnythingThatIsNotHttps_IsNeverALink', () => {
      for (const url of ['http://www.notifiche.ti.ch', 'javascript:alert(1)', 'data:text/html,<p>x</p>', 'notifiche.ti.ch', '', '   ', null, undefined]) {
        expect(portalLink(url), String(url)).toBeNull();
      }
    });
  });

  it('isTicinoRegime_OnlyTheCantonOfTicino', () => {
    expect(isTicinoRegime(regime())).toBe(true);
    expect(isTicinoRegime(regime({ cantonCode: 'ZH' }))).toBe(false);
    expect(isTicinoRegime(regime({ cantonCode: null }))).toBe(false);
    expect(isTicinoRegime(null)).toBe(false);
  });

  it('DutyAnswers_AreTheTwoSettingsOfTheHostInTheOrderOfTheButtons', () => {
    expect(DUTY_ANSWERS).toEqual(['Required', 'NotRequired']);
  });

  // The words of the card, in both languages: every member of every enum the API writes has its sentence (a missing one would read as the raw value).
  describe.each(['it', 'en'])('the texts in %s', (language) => {
    it('EveryMemberOfEveryEnum_HasItsText', () => {
      const groups: Array<[string, readonly string[]]> = [
        ['short.obligation', GUEST_REGISTRATION_OBLIGATIONS],
        ['channel', GUEST_REGISTRATION_CHANNELS],
        ['short.channel', GUEST_REGISTRATION_CHANNELS],
        ['deadline', GUEST_REGISTRATION_DEADLINE_KINDS],
        ['short.privateRentals', GUEST_REGISTRATION_PRIVATE_RENTALS.filter((member) => member !== 'Yes')],
      ];
      for (const [group, members] of groups) {
        for (const member of members) expect(i18n.exists(`guestRegistration.${group}.${member}`, { lng: language }), `${group}.${member}`).toBe(true);
      }
      for (const certainty of GUEST_REGISTRATION_CERTAINTIES) {
        expect(i18n.exists(`guestRegistration.certainty.${certainty}.label`, { lng: language }), certainty).toBe(true);
        expect(i18n.exists(`guestRegistration.certainty.${certainty}.text`, { lng: language }), certainty).toBe(true);
      }
      // The three duties are told by the duty block, with the words of its two answers.
      expect(GUEST_REGISTRATION_DUTIES).toEqual(['Required', 'NotRequired', 'Ask']);
      for (const key of ['required', 'answeredRequired', 'answeredNotRequired', 'askTitle', 'askQuestion', 'mustNotify', 'mustNotNotify', 'change', 'saveFailed']) {
        expect(i18n.exists(`guestRegistration.duty.${key}`, { lng: language }), key).toBe(true);
      }
    });
  });
});
