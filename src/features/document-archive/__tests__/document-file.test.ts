import { describe, expect, it } from 'vitest';
import { archiveDocumentFileName, archiveDocumentKey, formatFileSize, isEmptyDocument } from '../document-file';

const row = (title: string, contentType = '', date = '2026-10-12') => ({ type: 'touristTax' as const, title, date, contentType });

describe('archiveDocumentFileName (NF-99)', () => {
  it('ArchiveDocumentFileName_TitleThatIsAFileName_IsKept', () => {
    expect(archiveDocumentFileName({ ...row('APE Villa Rosa.pdf'), type: 'propertyDocument' })).toBe('APE Villa Rosa.pdf');
  });

  it('ArchiveDocumentFileName_TitleThatIsNotAFileName_GetsTheDayAndTheExtensionOfTheFileThatCame', () => {
    expect(archiveDocumentFileName(row('Siracusa'), 'application/pdf')).toBe('2026-10-12-Siracusa.pdf');
    expect(archiveDocumentFileName(row('Siracusa'), 'image/jpeg; charset=binary')).toBe('2026-10-12-Siracusa.jpg');
  });

  it('ArchiveDocumentFileName_NoTypeFromTheAnswer_TakesTheOneOfTheRow', () => {
    expect(archiveDocumentFileName(row('Siracusa', 'image/png'))).toBe('2026-10-12-Siracusa.png');
  });

  it('ArchiveDocumentFileName_NoKnownType_HasNoExtensionRatherThanAWrongOne', () => {
    expect(archiveDocumentFileName(row('Siracusa', 'application/octet-stream'))).toBe('2026-10-12-Siracusa');
  });

  it('ArchiveDocumentFileName_CharactersTheSystemsRefuse_AreReplaced', () => {
    expect(archiveDocumentFileName(row('Casa: "Mare" / piano 2?'), 'application/pdf')).toBe('2026-10-12-Casa- -Mare- - piano 2-.pdf');
  });

  it('ArchiveDocumentFileName_PathInTheTitle_NeverLeavesTheFolderOrMakesAHiddenFile', () => {
    expect(archiveDocumentFileName({ ...row('../../etc/passwd.pdf'), type: 'propertyDocument' })).toBe('etc-passwd.pdf');
    expect(archiveDocumentFileName({ ...row('.bashrc.txt'), type: 'propertyDocument' })).toBe('bashrc.txt');
  });

  it('ArchiveDocumentFileName_NothingLeftOfTheTitle_FallsBackToTheType', () => {
    expect(archiveDocumentFileName(row('///'), 'application/pdf')).toBe('2026-10-12-touristTax.pdf');
    expect(archiveDocumentFileName(row('   '), 'application/pdf')).toBe('2026-10-12-touristTax.pdf');
  });

  it('ArchiveDocumentFileName_VeryLongName_IsCutBeforeTheExtension', () => {
    const name = archiveDocumentFileName({ ...row(`${'a'.repeat(300)}.pdf`), type: 'propertyDocument' });

    expect(name).toHaveLength(104);
    expect(name.endsWith('.pdf')).toBe(true);
  });
});

describe('formatFileSize', () => {
  it.each([
    [0, 'it', '0 byte'],
    [512, 'en', '512 byte'],
    [340 * 1024, 'en', '340 kB'],
    [1.2 * 1024 * 1024, 'it', '1,2 MB'],
    [20 * 1024 * 1024, 'en', '20 MB'],
  ])('FormatFileSize_%d_In_%s', (bytes, locale, expected) => {
    expect(formatFileSize(bytes, locale).replace(/[\u00a0\u202f]/g, ' ')).toBe(expected);
  });
});

describe('archiveDocumentKey and isEmptyDocument', () => {
  it('ArchiveDocumentKey_TypeGoesWithTheId', () => {
    expect(archiveDocumentKey({ type: 'contract', id: 'x' })).toBe('contract:x');
  });

  it('IsEmptyDocument_OnlyAFileOfZeroBytes_IsEmpty_NotOneOfUnknownSize', () => {
    expect(isEmptyDocument({ sizeBytes: 0 })).toBe(true);
    expect(isEmptyDocument({ sizeBytes: null })).toBe(false);
    expect(isEmptyDocument({ sizeBytes: 12 })).toBe(false);
  });
});
