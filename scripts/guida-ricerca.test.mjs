// @vitest-environment node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'vitest';

const qui = path.dirname(fileURLToPath(import.meta.url));
const guida = path.join(qui, '..', 'public', 'guida');
function carica(dati) {
  const window = {};
  new Function('window', fs.readFileSync(path.join(guida, 'assets', 'guida-ricerca.js'), 'utf8'))(window);
  window.GuidaRicerca.prepara(dati);
  return window.GuidaRicerca;
}

const voce = (t, titolo, testo = '', extra = {}) => ({ t, titolo, sezione: 'Prova', ctx: 'Pagina di prova', url: `prova.html#${titolo.length}-${t}`, testo, kw: '', pg: 'prova', ...extra });
const riempitivi = Array.from({ length: 40 }, (_, i) => voce('faq', `Domanda numero ${i} sulla casa`, 'La casa è un immobile', { url: `riempitivo.html#${i}` }));
const dati = {
  pagine: { prova: 'esempio' },
  voci: [
    voce('howto', 'Collegare un calendario iCal', 'Incolla il link del portale nel calendario.'),
    voce('howto', 'Registrare un incasso', 'Premi «Registra incasso» e scegli il metodo.'),
    voce('howto', 'Annullare una prenotazione', 'Apri la prenotazione e premi «Annulla».'),
    voce('faq', 'Quanto dura un rimborso?', 'Il rimborso arriva in pochi giorni.'),
    voce('termine', 'iCal', 'Un link che permette ai calendari di scambiarsi le date.', { url: 'glossario.html' }),
    voce('howto', "Impostare l'imposta di soggiorno", 'Scrivi la tariffa del comune.'),
    ...riempitivi,
  ],
};
const titoli = (r) => r.map((e) => e.titolo);

test('fold toglie accenti, apostrofi e maiuscole', () => {
  const { fold } = carica(dati);
  assert.equal(fold("L'ospite è già QUI"), 'l ospite e gia qui');
  assert.equal(fold(undefined), '');
});

test('forme diverse della stessa parola trovano la stessa voce (collego/collegare, incassare/incasso, prenotazioni/prenotazione)', () => {
  const g = carica(dati);
  assert.equal(g.cerca('come collego un calendario', 3)[0].titolo, 'Collegare un calendario iCal');
  assert.equal(g.cerca('come faccio a incassare', 3)[0].titolo, 'Registrare un incasso');
  assert.equal(g.cerca('annullare le prenotazioni', 3)[0].titolo, 'Annullare una prenotazione');
});

test('tollera un errore di battitura nelle parole lunghe e completa l\'ultima parola', () => {
  const g = carica(dati);
  assert.equal(g.cerca('calendraio', 3)[0].titolo, 'Collegare un calendario iCal');
  assert.ok(titoli(g.cerca('registrare un incas', 3)).includes('Registrare un incasso'));
});

test('«cosa significa X» mette il glossario davanti, e il titolo esatto vince', () => {
  const g = carica(dati);
  assert.equal(g.cerca('cosa significa ical', 3)[0].t, 'termine');
  assert.equal(g.cerca('Quanto dura un rimborso?', 3)[0].titolo, 'Quanto dura un rimborso?');
});

test('sinonimi del mestiere: la tassa di soggiorno è l\'imposta di soggiorno', () => {
  const g = carica(dati);
  assert.equal(g.cerca('tassa di soggiorno', 3)[0].titolo, "Impostare l'imposta di soggiorno");
});

test('niente risultati per sole parole vuote, parole sconosciute o una sola parola generica', () => {
  const g = carica(dati);
  assert.deepEqual(g.cerca('come fare', 5), []);
  assert.deepEqual(g.cerca('xyzzy', 5), []);
  assert.deepEqual(g.cerca('', 5), []);
  assert.deepEqual(g.cerca('vacanza casa', 5), []);
  assert.ok(g.cerca('casa', 5).length > 0);
});

test('sul manuale vero: il titolo di ogni voce, scritto come domanda, riporta quella voce nei primi 3 risultati', { timeout: 120_000 }, () => {
  const dir = path.join(guida, 'guida-indice.js');
  const window = {};
  new Function('window', fs.readFileSync(dir, 'utf8'))(window);
  const g = carica(window.GUIDA_INDICE);
  const voci = window.GUIDA_INDICE.voci;
  const persi = voci.filter((v) => !g.cerca(v.titolo, 3).some((r) => g.fold(r.titolo) === g.fold(v.titolo)));
  assert.ok(persi.length <= voci.length * 0.02, `Titoli non ritrovati: ${persi.length}/${voci.length}, per esempio: ${persi.slice(0, 5).map((v) => v.titolo).join(' | ')}`);
});
