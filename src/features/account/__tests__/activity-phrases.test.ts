import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/i18n/config';
import type { OrgActivityEntry } from '@/types/org-team.types';
import { activityActor, activityPhrase } from '../activity-phrases';

function entry(patch: Partial<OrgActivityEntry>): OrgActivityEntry {
  return {
    id: 'line-1',
    when: '2026-11-01T18:00:00Z',
    actorUserId: 'auth0|owner',
    area: 'short-rent',
    type: 'PropertyActivatedWithReminders',
    subjectType: 'Property',
    subjectId: 'prop-1',
    details: {},
    ...patch,
  };
}

describe('activityPhrase', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
  });

  it('activityPhrase_PropertyActivatedWithReminders_SaysWhichRemindersWereOpen', () => {
    const context = { t: i18n.t, memberName: () => undefined };

    expect(activityPhrase(entry({ details: { reminders: 'documents.safety' } }), context)).toBe(
      'Immobile attivato con i documenti e la scheda di sicurezza da completare',
    );
    expect(activityPhrase(entry({ details: { reminders: 'safety' } }), context)).toBe(
      'Immobile attivato con la scheda di sicurezza da completare',
    );
    // A code this page does not know: the generic sentence, never a raw key.
    expect(activityPhrase(entry({ details: { reminders: 'something' } }), context)).toBe("Modifica all'account");
  });

  // E20/F03/US01/T01: every opening of a credential of the support vault is a line of the log that the host reads, with the kind of credential and never its value or the reason.
  describe('the «Do it for me» lines', () => {
    const context = { t: i18n.t, memberName: () => undefined };
    const assist = (patch: Partial<OrgActivityEntry>) => entry({ type: 'OnboardingAssistUpdated', subjectType: 'Org', details: {}, ...patch });

    it.each([
      ['panel', 'Il supporto CasaZen ha usato le credenziali del pannello del tuo channel manager per fare il collegamento che avevi chiesto'],
      ['police', 'Il supporto CasaZen ha usato le credenziali di Alloggiati Web per fare il collegamento che avevi chiesto'],
      ['regionalIstat', 'Il supporto CasaZen ha usato le credenziali ISTAT per fare il collegamento che avevi chiesto'],
    ])('activityPhrase_SupportOpenedTheCredential_%s_SaysWhichOneWasUsed', (credential, sentence) => {
      expect(activityPhrase(assist({ details: { part: 'compliance', context: 'panelPolice', status: 'inProgress', credential } }), context)).toBe(sentence);
    });

    it('activityPhrase_SupportTookClosedOrCancelledARequest_SaysWhatSupportDid', () => {
      expect(activityPhrase(assist({ details: { status: 'inProgress' } }), context)).toBe('Il supporto CasaZen ha preso in carico la tua richiesta di aiuto');
      expect(activityPhrase(assist({ details: { status: 'done' } }), context)).toBe('Il supporto CasaZen ha chiuso la tua richiesta di aiuto: dice di averla fatta');
      expect(activityPhrase(assist({ details: { status: 'cancelled' } }), context)).toBe('Il supporto CasaZen ha annullato la tua richiesta di aiuto');
    });

    it('activityPhrase_TheHostAskedOrReopenedARequest_NamesTheMemberWhoAskedAndIsNeverInTheSecondPerson', () => {
      // The whole team reads the line: it says who asked, whoever reads it.
      const asked = assist({ type: 'OnboardingAssistRequested', actorUserId: 'auth0|anna', details: { status: 'requested' } });
      expect(activityPhrase(asked, { t: i18n.t, memberName: (userId) => (userId === 'auth0|anna' ? 'Anna Rossi' : undefined) })).toBe('Anna Rossi ha chiesto aiuto al supporto CasaZen');
      // A person who is not in the team any more is still told as such, not as nobody.
      expect(activityPhrase(asked, context)).toBe('Ex membro ha chiesto aiuto al supporto CasaZen');
    });

    // The lines support writes have as their actor a person of platform support, who is not a member of the team: never «Ex membro», and no name of a person of support.
    describe('who did it', () => {
      const staff = 'auth0|staff-1';
      const team = (userId: string) => (userId === 'auth0|anna' ? 'Anna Rossi' : undefined);

      it.each([
        ['a credential opened', { details: { credential: 'regionalIstat' } }],
        ['a request taken', { details: { status: 'inProgress' } }],
        ['a request closed', { details: { status: 'done' } }],
      ])('activityActor_SupportDid_%s_IsCasaZenSupportNeverAFormerMember', async (_what, patch) => {
        for (const [language, expected] of [['it', 'Supporto CasaZen'], ['en', 'CasaZen support']] as const) {
          await i18n.changeLanguage(language);
          const actor = activityActor(assist({ actorUserId: staff, ...patch }), { t: i18n.t, memberName: () => undefined });
          expect(actor, language).toBe(expected);
          expect(actor, language).not.toMatch(/ex membro|former member|auth0/i);
        }
      });

      it('activityActor_APersonOfTheTeamDidIt_IsTheirNameAndAPersonWhoLeftIsAFormerMember', () => {
        expect(activityActor(assist({ type: 'OnboardingAssistRequested', actorUserId: 'auth0|anna' }), { t: i18n.t, memberName: team })).toBe('Anna Rossi');
        expect(activityActor(assist({ type: 'OnboardingAssistRequested', actorUserId: 'auth0|gone' }), { t: i18n.t, memberName: team })).toBe('Ex membro');
        expect(activityActor(entry({ type: 'MemberInvited', actorUserId: 'auth0|gone' }), { t: i18n.t, memberName: team })).toBe('Ex membro');
      });

      it('activityActor_NobodyDidIt_IsTheSystem', () => {
        expect(activityActor(entry({ type: 'PlanChanged', actorUserId: null }), { t: i18n.t, memberName: team })).toBe('Sistema');
      });
    });

    it('activityPhrase_ACredentialOrStatusThisPageDoesNotKnow_IsTheGenericSentenceNeverARawCode', () => {
      expect(activityPhrase(assist({ details: { credential: 'telepathy' } }), context)).toBe("Modifica all'account");
      expect(activityPhrase(assist({ details: { status: 'quarantined' } }), context)).toBe("Modifica all'account");
      expect(activityPhrase(assist({ details: {} }), context)).toBe("Modifica all'account");
    });

    it('activityPhrase_TheSentencesInBothLanguages_NeverNameTheSupplierOfTheChannelManager', async () => {
      for (const language of ['it', 'en']) {
        await i18n.changeLanguage(language);
        const sentences = [
          ...['panel', 'police', 'regionalIstat'].map((credential) => activityPhrase(assist({ details: { credential } }), context)),
          ...['inProgress', 'done', 'cancelled'].map((status) => activityPhrase(assist({ details: { status } }), context)),
          activityPhrase(assist({ type: 'OnboardingAssistRequested' }), context),
        ];
        for (const sentence of sentences) {
          expect(sentence, language).not.toMatch(/octorate|account\.activity/i);
        }
      }
    });
  });
});
