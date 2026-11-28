import { describe, expect, it } from 'vitest';
import { addLine, cleanEntries, isPublicHttpsUrl, withCurrent } from '../settings-rules';

describe('settings rules', () => {
  it('accepts only the https addresses the server accepts', () => {
    expect(isPublicHttpsUrl('https://www.villasofia.it')).toBe(true);
    expect(isPublicHttpsUrl(' https://www.villasofia.it/camere ')).toBe(true);
    expect(isPublicHttpsUrl('http://www.villasofia.it')).toBe(false);
    expect(isPublicHttpsUrl('https://localhost')).toBe(false);
    expect(isPublicHttpsUrl('https://user:secret@www.villasofia.it')).toBe(false);
    expect(isPublicHttpsUrl('www.villasofia.it')).toBe(false);
    expect(isPublicHttpsUrl('')).toBe(false);
  });

  it('keeps a value chosen before, even when it is not one of the usual choices, in order', () => {
    expect(withCurrent([2, 3, 4, 5, 10], 3)).toEqual([2, 3, 4, 5, 10]);
    expect(withCurrent([2, 3, 4, 5, 10], 7)).toEqual([2, 3, 4, 5, 7, 10]);
    expect(withCurrent([7, 14, 30], 45)).toEqual([7, 14, 30, 45]);
  });

  it('adds a line once and never glues it to the previous one', () => {
    expect(addLine('', 'Racconta le novità.')).toBe('Racconta le novità.');
    expect(addLine('Prima riga', 'Seconda riga')).toBe('Prima riga\nSeconda riga');
    expect(addLine('Prima riga\n', 'Seconda riga')).toBe('Prima riga\nSeconda riga');
    expect(addLine('Prima riga\nSeconda riga', 'Seconda riga')).toBe('Prima riga\nSeconda riga');
  });

  it('drops the empty entries and trims the others', () => {
    expect(cleanEntries({ casa: '  nota  ', altra: '   ', vuota: '' })).toEqual({ casa: 'nota' });
  });
});
