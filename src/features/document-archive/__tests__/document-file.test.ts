import { describe, expect, it } from 'vitest';
import { archiveDocumentFileName, archiveDocumentKey, archiveDownloadFileName, contentDispositionFileName, formatFileSize, isEmptyDocument } from '../document-file';

const row = (title: string, contentType = '', date = '2026-10-12') => ({ type: 'touristTax' as const, title, date, contentType });

// The API exposes `Content-Disposition` to the page (CORS): the file is saved under the name the server gave it, the original one of a receipt included.
describe('contentDispositionFileName (NF-99)', () => {
  it.each([
    ['the name with its charset wins over the plain one', `attachment; filename="Ricevuta _.pdf"; filename*=UTF-8''Ricevuta%20%C3%A8.pdf`, 'Ricevuta è.pdf'],
    ['the charset in any case, the names in any order', `ATTACHMENT; FILENAME*=utf-8''F24.pdf; FILENAME="f24-copy.pdf"`, 'F24.pdf'],
    ['a plain quoted name', 'attachment; filename="APE Villa Rosa.pdf"', 'APE Villa Rosa.pdf'],
    ['a plain name that is a token', 'attachment; filename=ricevuta.pdf', 'ricevuta.pdf'],
    ['a plain name with a semicolon and escaped quotes in it', 'attachment; filename="a \\"b\\"; c.pdf"', 'a -b-; c.pdf'],
    ['a name that is a path', 'attachment; filename="../../etc/passwd"', 'etc-passwd'],
    ['an extended name that is not well written, so the plain one', `attachment; filename*=UTF-8''%E0%A4%A; filename="ricevuta.pdf"`, 'ricevuta.pdf'],
    ['an extended name in a charset it does not read, so the plain one', `attachment; filename*=ISO-8859-1''Ricevuta%E8.pdf; filename="Ricevuta_.pdf"`, 'Ricevuta_.pdf'],
  ])('ContentDispositionFileName_%s', (_name, header, expected) => {
    expect(contentDispositionFileName(header)).toBe(expected);
  });

  it.each([
    ['no header', null],
    ['no header at all', undefined],
    ['an empty header', ''],
    ['a header with no name', 'attachment'],
    ['an empty name', 'attachment; filename=""'],
    ['a name of nothing but what a system refuses', 'attachment; filename="///"'],
  ])('ContentDispositionFileName_%s_IsNoName', (_name, header) => {
    expect(contentDispositionFileName(header)).toBeNull();
  });
});

describe('archiveDownloadFileName (NF-99)', () => {
  it('ArchiveDownloadFileName_TheServerGivesAName_ItIsTheOneOfTheFile', () => {
    expect(archiveDownloadFileName(row('Siracusa'), 'application/pdf', `attachment; filename*=UTF-8''F24%20Siracusa.pdf`)).toBe('F24 Siracusa.pdf');
  });

  // The header is read only where the API exposes it to the page: with none, or with no name in it, the name is rebuilt from the row, and nothing fails.
  it.each([
    ['no header', null],
    ['no header at all', undefined],
    ['a header with no name', 'attachment'],
  ])('ArchiveDownloadFileName_%s_IsTheNameRebuiltFromTheRow', (_name, header) => {
    expect(archiveDownloadFileName(row('Siracusa'), 'application/pdf', header)).toBe('2026-10-12-Siracusa.pdf');
  });
});

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
