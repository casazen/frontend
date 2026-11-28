import { describe, expect, it } from 'vitest';
import { canImport, detectColumns, importFileProblem, importReasonKey, sampleGuest, wireMapping } from '../import-columns';

describe('import columns', () => {
  it('recognizes Italian headers of a typical guest export', () => {
    expect(detectColumns(['Nome e cognome', 'E-mail', 'Cellulare', 'Nazione', 'Ultimo soggiorno', 'Note'])).toEqual({
      name: 0,
      email: 1,
      phone: 2,
      country: 3,
      lastStay: 4,
    });
  });

  it('recognizes English headers, with accents and capitals ignored', () => {
    expect(detectColumns(['Guest Name', 'Email Address', 'Phone', 'Language', 'Country', 'Check-in', 'Check-out', 'Tags'])).toEqual({
      name: 0,
      email: 1,
      phone: 2,
      language: 3,
      country: 4,
      firstStay: 5,
      lastStay: 6,
      tags: 7,
    });
  });

  it('keeps the field ids the old form matched', () => {
    expect(detectColumns(['name', 'email', 'phone', 'language', 'country', 'firstStay', 'lastStay', 'tags'])).toEqual({
      name: 0,
      email: 1,
      phone: 2,
      language: 3,
      country: 4,
      firstStay: 5,
      lastStay: 6,
      tags: 7,
    });
  });

  it('finds a header that only contains the word, without taking a longer word for it', () => {
    expect(detectColumns(['Hotel', 'Email principale'])).toEqual({ email: 1 });
  });

  it('never uses the same column for two data', () => {
    expect(detectColumns(['Email', 'Email'])).toEqual({ email: 0 });
  });

  it('leaves the unknown columns unmatched', () => {
    expect(detectColumns(['Colonna A', 'Colonna B', ''])).toEqual({});
  });

  it('needs an e-mail or a phone to import', () => {
    expect(canImport({})).toBe(false);
    expect(canImport({ name: 0 })).toBe(false);
    expect(canImport({ phone: 2 })).toBe(true);
    expect(canImport({ email: 0 })).toBe(true);
  });

  it('sends only the columns that were chosen', () => {
    expect(wireMapping({ email: 1, name: undefined, phone: 0 })).toEqual({ email: 1, phone: 0 });
  });

  it('refuses a file that is not CSV or Excel, or is over 2 MB, before the upload', () => {
    expect(importFileProblem(new File(['x'], 'ospiti.csv'))).toBeNull();
    expect(importFileProblem(new File(['x'], 'OSPITI.XLSX'))).toBeNull();
    expect(importFileProblem(new File(['x'], 'ospiti.pdf'))).toBe('type');
    expect(importFileProblem(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'grande.csv'))).toBe('size');
  });

  it('reads a sample row through the chosen columns, with empty text for what is not chosen', () => {
    expect(sampleGuest(['Maria Bianchi', ' maria@esempio.it ', '+39 333 1234567', 'Italia', '12/08/2025'], { name: 0, email: 1, country: 3, lastStay: 4 })).toEqual({
      name: 'Maria Bianchi',
      email: 'maria@esempio.it',
      phone: '',
      country: 'Italia',
      lastStay: '12/08/2025',
    });
    expect(sampleGuest(['solo una cella'], { email: 4 }).email).toBe('');
  });

  it('turns the reasons of the server into the keys of plain sentences', () => {
    expect(importReasonKey('invalid_contact')).toBe('marketingHub.importWizard.reasons.contact');
    expect(importReasonKey('invalid_stay_dates')).toBe('marketingHub.importWizard.reasons.dates');
    expect(importReasonKey('invalid_profile')).toBe('marketingHub.importWizard.reasons.profile');
    expect(importReasonKey('something_new')).toBe('marketingHub.importWizard.reasons.other');
  });
});
