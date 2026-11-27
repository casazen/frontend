import { describe, expect, it } from 'vitest';
import { guideSteps } from '../guide-steps';

describe('guideSteps', () => {
  it('turns the numbered lines of the host into steps, without their numbers', () => {
    expect(guideSteps('1. Parcheggia in Via Bellinzona.\n2) Entra dal portone.\n3. Piano 2, a sinistra.')).toEqual([
      'Parcheggia in Via Bellinzona.',
      'Entra dal portone.',
      'Piano 2, a sinistra.',
    ]);
  });

  it('turns ticked lines into steps', () => {
    expect(guideSteps('- Parcheggia\n• Entra\n* Sali')).toEqual(['Parcheggia', 'Entra', 'Sali']);
  });

  it('turns paragraphs set apart by a blank line into steps, keeping the lines of each one', () => {
    expect(guideSteps('Guida lungo il lago.\nParcheggia a destra.\n\nInserisci il codice.\r\n  \r\nChiama l’ascensore.')).toEqual([
      'Guida lungo il lago.\nParcheggia a destra.',
      'Inserisci il codice.',
      'Chiama l’ascensore.',
    ]);
  });

  it('keeps a few lines of prose as one text', () => {
    expect(guideSteps('Il check-in è dalle 15.\nChiama quando arrivi.')).toEqual([]);
  });

  it('keeps a single step as one text', () => {
    expect(guideSteps('1. Chiama quando arrivi.')).toEqual([]);
  });
});
