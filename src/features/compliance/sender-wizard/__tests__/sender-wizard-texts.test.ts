import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en.json';
import it_ from '@/i18n/locales/it.json';

/**
 * What the confirmation of a change of the sender tells the host (E03/F01/US02/T02, ADR-029: a double send is a violation). The texts say the exact effect, the one the backend says
 * in its own confirmation (`SenderSwitchConfirmationRequired`): the sender in effect goes off, and the channel manager's own daily sending is switched off by the host in its panel,
 * or the data would go out twice. Nothing promises automatic sending before its state is «Attivo»: after the change the sender can still be «Non verificato» or «Non attivo».
 */
const LOCALES = [
  {
    language: 'it',
    locale: it_,
    promise: /non devi più inviarli a mano|da ora i dati li invia in automatico/i,
    keepsSending: /finché lo stato (?:del nuovo invio )?non è «Attivo» continui a inviar/i,
    panel: /spegni l'invio automatico anche nel suo pannello/i,
    twice: /due volte/i,
  },
  {
    language: 'en',
    locale: en,
    promise: /no longer have to send it by hand|from now on the service you chose sends the data automatically/i,
    keepsSending: /until the state (?:of the new sender )?is «Active» you keep sending it yourself/i,
    panel: /switch its automatic sending off in its panel too/i,
    twice: /twice/i,
  },
] as const;

describe('the words of the change of the sender', () => {
  it.each(LOCALES)('$language: switching on from the own send promises nothing before the state is «Attivo»', ({ locale, promise, keepsSending }) => {
    const text = locale.compliance.sender.summary.switch.manualToAutomatic;

    expect(text).not.toMatch(promise);
    expect(text).toMatch(keepsSending);
  });

  it.each(LOCALES)('$language: leaving an automatic sender says to switch the channel manager off in its panel, or the data go out twice', ({ locale, panel, twice }) => {
    for (const text of [locale.compliance.sender.summary.switch.toManual, locale.compliance.sender.summary.switch.automaticToAutomatic]) {
      expect(text).toMatch(panel);
      expect(text).toMatch(twice);
    }
  });

  it.each(LOCALES)('$language: the change to another automatic sender keeps the host sending until the new one is «Attivo»', ({ locale, promise, keepsSending }) => {
    const text = locale.compliance.sender.summary.switch.automaticToAutomatic;

    expect(text).not.toMatch(promise);
    expect(text).toMatch(keepsSending);
  });

  it.each(LOCALES)('$language: no text of the change names the supplier of the channel manager', ({ locale }) => {
    for (const text of Object.values(locale.compliance.sender.summary.switch)) expect(text).not.toMatch(/octorate/i);
  });
});

// The texts of the wizard are in alphabetical order at every level, in both languages (the rule of the locale files).
describe('the keys of compliance.sender', () => {
  const alphabetical = (a: string, b: string) => (a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);

  function unsortedLevels(node: unknown, path: string): string[] {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return [];
    const keys = Object.keys(node);
    const here = keys.join() === [...keys].sort(alphabetical).join() ? [] : [path];
    return [...here, ...keys.flatMap((key) => unsortedLevels((node as Record<string, unknown>)[key], `${path}.${key}`))];
  }

  it.each(LOCALES)('$language: every level is in alphabetical order', ({ locale }) => {
    expect(unsortedLevels(locale.compliance.sender, 'compliance.sender')).toEqual([]);
  });
});
