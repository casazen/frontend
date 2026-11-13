import { describe, expect, it } from 'vitest';
import { exportFileName, proofFileName } from '../proof-file';

const entry = (change: Partial<Parameters<typeof proofFileName>[0]> = {}) => ({ kind: 'IstatProof' as const, day: '2026-08-01', period: '2026-08', contentType: 'application/pdf', ...change });

describe('proofFileName', () => {
  it('proofFileName_TheServerGaveAName_IsThatNameMadeSafe', () => {
    expect(proofFileName(entry(), 'application/pdf', 'attachment; filename="ricevuta-agosto.pdf"')).toBe('ricevuta-agosto.pdf');
    // A name with a path in it stays inside the folder it is saved to.
    expect(proofFileName(entry(), 'application/pdf', 'attachment; filename="../../etc/passwd"')).not.toContain('/');
  });

  it.each([
    [{ kind: 'IstatProof' as const }, 'prova-istat_2026-08.pdf'],
    [{ kind: 'AlloggiatiReceipt' as const, day: '2026-08-15', period: null }, 'ricevuta-alloggiati_2026-08-15.pdf'],
    [{ kind: 'TouristTaxDeclaration' as const }, 'dichiarazione-imposta-di-soggiorno_2026-08.pdf'],
    [{ kind: 'TouristTaxPayment' as const }, 'pagamento-imposta-di-soggiorno_2026-08.pdf'],
  ])('proofFileName_NoHeader_IsRebuiltFromTheRow_%j', (change, name) => {
    expect(proofFileName(entry(change), 'application/pdf', null)).toBe(name);
  });

  it('proofFileName_NoHeader_TakesTheExtensionFromTheFileThatArrived', () => {
    expect(proofFileName(entry({ contentType: 'application/pdf' }), 'image/png', null)).toBe('prova-istat_2026-08.png');
    expect(proofFileName(entry({ contentType: 'image/jpeg' }), '', undefined)).toBe('prova-istat_2026-08.jpg');
  });

  it('proofFileName_AKindThisVersionDoesNotKnow_IsJustAProof', () => {
    expect(proofFileName(entry({ kind: 'Something' as never }), 'application/pdf', null)).toBe('prova_2026-08.pdf');
  });
});

describe('exportFileName', () => {
  it('exportFileName_ServerNameOrRebuilt', () => {
    expect(exportFileName("attachment; filename*=UTF-8''prove-2026.zip", 'casazen-prove.zip')).toBe('prove-2026.zip');
    expect(exportFileName(null, 'casazen-prove.zip')).toBe('casazen-prove.zip');
  });
});
