import { describe, expect, it } from 'vitest';
import type { ShowcaseReadinessItem } from '@/types/supplier-showcase';
import { editorStepOf, fixPathOf, halfFilledRows, stepPath } from '../showcase-model';

describe('halfFilledRows: the rows the publication would refuse (SP-13a ForPublication)', () => {
  it('lets empty rows and complete rows through', () => {
    expect(
      halfFilledRows({
        team: [{ name: '', role: '' }, { name: 'Marta Rossi', role: '' }, { name: 'Luca', role: 'Idraulico' }],
        certs: [{ label: '', detail: '' }, { label: 'Patentino F-Gas', detail: '' }],
        faq: [{ q: '', a: '' }, { q: 'Quanto costa?', a: 'Dipende dal lavoro.' }],
        guarantee: { title: '', text: '' },
      }),
    ).toEqual([]);
  });

  it('finds a role with no name, a detail with no certification, a question or an answer alone and a guarantee with only one half', () => {
    expect(
      halfFilledRows({
        team: [{ name: 'Luca', role: 'Idraulico' }, { name: '', role: 'Aiuto' }],
        certs: [{ label: '', detail: 'Rilasciato nel 2024' }],
        faq: [{ q: 'Quanto costa?', a: '' }, { q: '', a: 'Dipende.' }, { q: 'Fate fattura?', a: 'Sì.' }],
        guarantee: { title: 'Garanzia sul lavoro', text: '   ' },
      }),
    ).toEqual([
      { section: 'team', index: 1 },
      { section: 'certs', index: 0 },
      { section: 'faq', index: 0 },
      { section: 'faq', index: 1 },
      { section: 'guarantee', index: 0 },
    ]);
  });

  it('says nothing of a draft with no texts at all', () => {
    expect(halfFilledRows({})).toEqual([]);
  });
});

describe('the steps of the editor', () => {
  it('knows the steps that have a panel and nothing else', () => {
    expect(editorStepOf('style')).toBe('style');
    expect(editorStepOf('texts')).toBe('texts');
    expect(editorStepOf('publish')).toBe('publish');
    expect(editorStepOf('works')).toBeNull();
    expect(editorStepOf(null)).toBeNull();
    expect(stepPath('texts')).toBe('/app/supplier/showcase?step=texts');
  });

  it('offers a link to a target only when it leads somewhere', () => {
    const item = (target: string): ShowcaseReadinessItem => ({ code: 'x', level: 'todo', required: false, target });
    expect(fixPathOf(item('/app/supplier/services'))).toBe('/app/supplier/services');
    expect(fixPathOf(item('/app/supplier/showcase?step=style'))).toBe('/app/supplier/showcase?step=style');
    expect(fixPathOf(item('/app/supplier/showcase?step=works'))).toBeNull();
  });
});
