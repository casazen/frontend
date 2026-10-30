import { describe, expect, it } from 'vitest';
import type { StarterContent } from '@/lib/supplier-site/starter-content';
import { starterFill } from '../showcase-starter';

const starter: StarterContent = { tagline: 'Pulizie per case vacanza', intro: 'Pulizie tra un check-out e un check-in.', prep: ['Lascia le chiavi.', 'Metti al sicuro i documenti.'] };

describe('starterFill: the starting text goes only where the supplier has written nothing', () => {
  it('fills the sentence, the introduction and the tips of an empty draft, and the inverse takes them away again', () => {
    const fill = starterFill({}, starter);
    expect(fill?.patch).toEqual({ tagline: starter.tagline, intro: starter.intro, prep: starter.prep });
    expect(fill?.inverse).toEqual({ tagline: null, intro: null, prep: null });
  });

  it('keeps what is written: only the empty members are filled, and the inverse puts back only those', () => {
    const fill = starterFill({ tagline: 'La mia frase', intro: '   ', prep: ['', '  '] }, starter);
    expect(fill?.patch).toEqual({ intro: starter.intro, prep: starter.prep });
    expect(fill?.inverse).toEqual({ intro: '   ', prep: ['', '  '] });
  });

  it('offers nothing when the three are written', () => {
    expect(starterFill({ tagline: 'La mia frase', intro: 'La mia introduzione', prep: ['Un consiglio'] }, starter)).toBeNull();
  });
});
