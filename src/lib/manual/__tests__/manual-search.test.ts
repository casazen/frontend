import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createManual, type ManualSource } from '../manual-search';

const ENGINE_FILE = resolve(process.cwd(), 'public/guida/assets/guida-ricerca.js');

function realEngine(): ManualSource['engine'] {
  const scope: { GuidaRicerca?: ManualSource['engine'] } = {};
  new Function('window', readFileSync(ENGINE_FILE, 'utf8'))(scope);
  if (!scope.GuidaRicerca) throw new Error('the engine of the manual did not register');
  return scope.GuidaRicerca;
}

const INDEX: ManualSource['index'] = {
  rotte: {
    '/app/short-rent/properties': ['immobili'],
    '/app/short-rent/properties/:id': ['immobili'],
    '/app/short-rent/properties/:id/edit': ['immobili', 'prezzi-tariffe'],
    '/app/short-rent/bookings': ['prenotazioni'],
  },
  voci: [
    { t: 'pagina', titolo: 'Immobili', sezione: 'Affitti brevi', ctx: 'Pagina', url: 'immobili.html' },
    { t: 'pagina', titolo: 'Prenotazioni e calendario', sezione: 'Affitti brevi', ctx: 'Pagina', url: 'prenotazioni.html' },
    { t: 'howto', pg: 'immobili', titolo: 'Aggiungere un immobile con la procedura guidata', sezione: 'Affitti brevi', ctx: 'Immobili', url: 'immobili.html#aggiungere-un-immobile' },
    { t: 'howto', pg: 'immobili', titolo: 'Mettere in pausa e riattivare un immobile', sezione: 'Affitti brevi', ctx: 'Immobili', url: 'immobili.html#pausa' },
    { t: 'howto', pg: 'immobili', titolo: 'Eliminare un immobile', sezione: 'Affitti brevi', ctx: 'Immobili', url: 'immobili.html#eliminare' },
    { t: 'howto', pg: 'prenotazioni', titolo: 'Creare una prenotazione manuale', sezione: 'Affitti brevi', ctx: 'Prenotazioni e calendario', url: 'prenotazioni.html#creare' },
    { t: 'faq', pg: 'immobili', titolo: 'Non riesco ad attivare la casa: cosa devo fare?', sezione: 'Affitti brevi', ctx: 'Immobili', url: 'immobili.html#non-riesco-ad-attivare' },
  ],
};

function manualWith(index = INDEX) {
  const engine = realEngine();
  engine.prepara(index);
  const load = vi.fn(async () => ({ engine, index }));
  return { manual: createManual(load), load };
}

describe('the manual as something the app can ask', () => {
  it('Search_Question_AnswersWithTheEntriesOfTheManualAndTheAddressOfEach', async () => {
    const { manual } = manualWith();

    const hits = await manual.search('come aggiungo un immobile');

    expect(hits[0]).toEqual({
      id: 'immobili.html#aggiungere-un-immobile',
      type: 'howto',
      title: 'Aggiungere un immobile con la procedura guidata',
      chapter: 'Immobili',
      href: '/guida/immobili.html#aggiungere-un-immobile',
    });
  });

  it('Search_TooShortAQuestion_AsksNothingAndDoesNotLoadTheManual', async () => {
    const { manual, load } = manualWith();

    expect(await manual.search(' a ')).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('Search_ChapterEntry_NamesItsSectionInsteadOfItself', async () => {
    const { manual } = manualWith();

    const [chapter] = await manual.search('prenotazioni calendario');

    expect(chapter).toMatchObject({ type: 'pagina', chapter: 'Affitti brevi', href: '/guida/prenotazioni.html' });
  });

  it('HintsFor_PageOfTheApp_GivesItsChapterAndTheFirstTasks', async () => {
    const { manual } = manualWith();

    const hints = await manual.hintsFor('/app/short-rent/properties/6a1b', 2);

    expect(hints?.chapter).toMatchObject({ title: 'Immobili', href: '/guida/immobili.html' });
    expect(hints?.tasks.map((task) => task.title)).toEqual(['Aggiungere un immobile con la procedura guidata', 'Mettere in pausa e riattivare un immobile']);
  });

  it('HintsFor_PageWithNoChapterOfItsOwn_FallsBackToTheNearestPageAbove', async () => {
    const { manual } = manualWith();

    const hints = await manual.hintsFor('/app/short-rent/bookings/b-1/payments/receipt');

    expect(hints?.chapter.title).toBe('Prenotazioni e calendario');
  });

  it('HintsFor_RouteExplainedByTwoChapters_TakesTheFirst', async () => {
    const { manual } = manualWith();

    const hints = await manual.hintsFor('/app/short-rent/properties/6a1b/edit');

    expect(hints?.chapter.title).toBe('Immobili');
  });

  it('HintsFor_PageTheManualDoesNotExplain_IsNull', async () => {
    const { manual } = manualWith();

    expect(await manual.hintsFor('/app/long-rent/anything')).toBeNull();
    expect(await manual.hintsFor('/')).toBeNull();
  });

  it('Search_ManualThatCannotBeLoaded_Fails_AndLoadsAgainTheNextTime', async () => {
    const engine = realEngine();
    engine.prepara(INDEX);
    const load = vi.fn<() => Promise<ManualSource>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ engine, index: INDEX });
    const manual = createManual(load);

    await expect(manual.search('immobile')).rejects.toThrow('offline');
    expect((await manual.search('immobile')).length).toBeGreaterThan(0);
    await manual.search('prenotazione');
    expect(load).toHaveBeenCalledTimes(2);
  });
});
