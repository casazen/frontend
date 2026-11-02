import { describe, expect, it } from 'vitest';
import { starterContentFor } from '@/lib/supplier-site/starter-content';
import type { SupplierService } from '@/types/supplier-services';
import { presentationPatch, presentationStepSchema, servicesPatch, servicesStepSchema, stylePatch, wizardStart, type WizardValues } from '../wizard/wizard-model';

const service = (slug: string, status: SupplierService['status'] = 'Active') => ({ id: `id-${slug}`, slug, name: slug, status }) as SupplierService;
const catalog = [service('pulizie'), service('bucato'), service('ripasso', 'Draft'), service('giardino')];
const starter = starterContentFor(['cleaning'])!;

const values = (patch: Partial<WizardValues> = {}): WizardValues => ({
  style: 'fresco',
  tagline: 'Case vacanza pronte per gli ospiti',
  intro: '',
  services: ['pulizie', 'bucato', 'giardino'],
  ...patch,
});

describe('wizardStart: where "Crea la tua vetrina" begins', () => {
  it('lays the starting text of the trade over a sentence and an introduction that are empty, and says it did', () => {
    const start = wizardStart({}, ['cleaning'], catalog);
    expect(start.values.tagline).toBe(starter.tagline);
    expect(start.values.intro).toBe(starter.intro);
    expect(start.prefilled).toBe(true);
    expect(start.values.style).toBe('fresco');
    expect(start.values.services).toEqual(['pulizie', 'bucato', 'giardino']);
  });

  it('keeps what the supplier wrote, and says nothing was prefilled when nothing was', () => {
    const start = wizardStart({ tagline: 'La mia frase', intro: 'La mia introduzione' }, ['cleaning'], catalog);
    expect(start.values.tagline).toBe('La mia frase');
    expect(start.values.intro).toBe('La mia introduzione');
    expect(start.prefilled).toBe(false);
  });

  it('leaves the fields empty for a trade with no starting text, and reads the services the draft names', () => {
    const start = wizardStart({ serviceOrder: ['giardino', 'pulizie'], style: 'acqua' }, ['events'], catalog);
    expect(start.values.tagline).toBe('');
    expect(start.prefilled).toBe(false);
    expect(start.values.style).toBe('acqua');
    expect(start.values.services).toEqual(['giardino', 'pulizie']);
  });
});

describe('the rules of the steps', () => {
  it('asks for a sentence of at least 12 characters and an introduction within its limit', () => {
    expect(presentationStepSchema.safeParse({ tagline: 'Ciao', intro: '' }).success).toBe(false);
    expect(presentationStepSchema.safeParse({ tagline: '            ', intro: '' }).success).toBe(false);
    expect(presentationStepSchema.safeParse({ tagline: 'Case vacanza pronte', intro: '' }).success).toBe(true);
    expect(presentationStepSchema.safeParse({ tagline: 'Case vacanza pronte', intro: 'x'.repeat(181) }).success).toBe(false);
    const refused = presentationStepSchema.safeParse({ tagline: 'Ciao', intro: '' });
    expect(refused.success ? [] : refused.error.issues.map((issue) => issue.message)).toEqual(['supplier.showcase.wizard.errors.tagline']);
  });

  it('asks for at least one service', () => {
    expect(servicesStepSchema.safeParse({ services: [] }).success).toBe(false);
    expect(servicesStepSchema.safeParse({ services: ['pulizie'] }).success).toBe(true);
  });
});

describe('what each step saves', () => {
  it('saves the style only when it is not the one the page already shows (the recommended one is not frozen)', () => {
    expect(stylePatch(values({ style: 'fresco' }), {}, ['cleaning'])).toBeNull();
    expect(stylePatch(values({ style: 'acqua' }), {}, ['cleaning'])).toEqual({ style: 'acqua' });
    expect(stylePatch(values({ style: 'fresco' }), { style: 'acqua' }, ['cleaning'])).toEqual({ style: 'fresco' });
  });

  it('saves the members of the presentation that changed, and clears an introduction that was emptied', () => {
    expect(presentationPatch(values({ tagline: 'La mia frase nuova', intro: '' }), { tagline: 'La mia frase nuova' })).toBeNull();
    expect(presentationPatch(values({ tagline: 'La mia frase nuova', intro: 'Due righe' }), { tagline: 'Vecchia frase' })).toEqual({ tagline: 'La mia frase nuova', intro: 'Due righe' });
    expect(presentationPatch(values({ tagline: 'Stessa frase qui', intro: '' }), { tagline: 'Stessa frase qui', intro: 'Prima c’era' })).toEqual({ intro: null });
  });

  it('sends no order while every active service is chosen, and the slugs otherwise, the ones already shown keeping their place', () => {
    expect(servicesPatch(values(), {}, catalog)).toBeNull();
    expect(servicesPatch(values({ services: ['pulizie', 'giardino'] }), {}, catalog)).toEqual({ serviceOrder: ['pulizie', 'giardino'] });
    // A custom order of the editor is kept for the ones that stay, the one that comes back goes last.
    expect(servicesPatch(values({ services: ['giardino', 'pulizie', 'bucato'] }), { serviceOrder: ['giardino', 'pulizie'] }, catalog)).toEqual({
      serviceOrder: ['giardino', 'pulizie', 'bucato'],
    });
    // Everything chosen again, with an order of the editor that left one out, is the catalog again: the order is cleared.
    expect(servicesPatch(values(), { serviceOrder: ['pulizie', 'bucato'] }, catalog)).toEqual({ serviceOrder: null });
  });
});
