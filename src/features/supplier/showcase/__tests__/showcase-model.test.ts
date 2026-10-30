import { describe, expect, it } from 'vitest';
import type { ShowcaseReadinessItem } from '@/types/supplier-showcase';
import { editorStepOf, fixPathOf, halfFilledRows, stepOfRow, stepPath } from '../showcase-model';

describe('halfFilledRows: the rows the publication would refuse (SP-13a ForPublication)', () => {
  it('lets empty rows and complete rows through', () => {
    expect(
      halfFilledRows({
        team: [{ name: '', role: '' }, { name: 'Marta Rossi', role: '' }, { name: 'Luca', role: 'Idraulico' }],
        certs: [{ label: '', detail: '' }, { label: 'Patentino F-Gas', detail: '' }],
        faq: [{ q: '', a: '' }, { q: 'Quanto costa?', a: 'Dipende dal lavoro.' }],
        guarantee: { title: '', text: '' },
        gallery: [{ photoUrl: '', beforeUrl: '', caption: '' }, { photoUrl: 'https://cdn.example/a.jpg', caption: 'Bagno rifatto' }],
      }),
    ).toEqual([]);
  });

  it('finds a role with no name, a detail with no certification, a question or an answer alone, a guarantee with only one half and a job with no photo', () => {
    expect(
      halfFilledRows({
        team: [{ name: 'Luca', role: 'Idraulico' }, { name: '', role: 'Aiuto' }],
        certs: [{ label: '', detail: 'Rilasciato nel 2024' }],
        faq: [{ q: 'Quanto costa?', a: '' }, { q: '', a: 'Dipende.' }, { q: 'Fate fattura?', a: 'Sì.' }],
        guarantee: { title: 'Garanzia sul lavoro', text: '   ' },
        gallery: [{ photoUrl: 'https://cdn.example/a.jpg' }, { photoUrl: '', caption: 'Senza foto' }, { photoUrl: '', beforeUrl: 'https://cdn.example/b.jpg' }],
      }),
    ).toEqual([
      { section: 'team', index: 1 },
      { section: 'certs', index: 0 },
      { section: 'faq', index: 0 },
      { section: 'faq', index: 1 },
      { section: 'guarantee', index: 0 },
      { section: 'gallery', index: 1 },
      { section: 'gallery', index: 2 },
    ]);
  });

  it('says nothing of a draft with no texts at all', () => {
    expect(halfFilledRows({})).toEqual([]);
  });

  it('puts the jobs right in their own step and the other lists in the texts', () => {
    expect(stepOfRow({ section: 'gallery', index: 0 })).toBe('works');
    expect(stepOfRow({ section: 'faq', index: 0 })).toBe('texts');
    expect(stepOfRow({ section: 'guarantee', index: 0 })).toBe('texts');
  });
});

describe('the steps of the editor', () => {
  it('knows the steps that have a panel and nothing else', () => {
    for (const step of ['style', 'works', 'texts', 'services', 'publish']) expect(editorStepOf(step)).toBe(step);
    expect(editorStepOf('contacts')).toBeNull();
    expect(editorStepOf(null)).toBeNull();
    expect(stepPath('texts')).toBe('/app/supplier/showcase?step=texts');
  });

  it('offers a link to a target only when it leads somewhere', () => {
    const item = (target: string): ShowcaseReadinessItem => ({ code: 'x', level: 'todo', required: false, target });
    expect(fixPathOf(item('/app/supplier/services'))).toBe('/app/supplier/services');
    expect(fixPathOf(item('/app/supplier/showcase?step=works'))).toBe('/app/supplier/showcase?step=works');
    expect(fixPathOf(item('/app/supplier/showcase?step=contacts'))).toBeNull();
  });
});
