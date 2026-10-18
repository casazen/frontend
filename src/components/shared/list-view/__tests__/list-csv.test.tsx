import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildCsv, columnCsvValue, csvCell, csvFileName, csvSeparatorFor, downloadCsv, listToCsv } from '../list-csv';
import { visibleColumns } from '../list-data';
import { STAYS, stayList } from './list-fixtures';

const BOM = '\uFEFF';

describe('csvCell', () => {
  it('quotes every cell', () => {
    expect(csvCell('Mario Rossi', ';')).toBe('"Mario Rossi"');
    expect(csvCell('', ';')).toBe('""');
    expect(csvCell(null, ';')).toBe('""');
    expect(csvCell(undefined, ';')).toBe('""');
  });

  it('doubles a quote inside a cell, and keeps a separator or a line break inside the quotes', () => {
    expect(csvCell('Il "Trullo"', ';')).toBe('"Il ""Trullo"""');
    expect(csvCell('a;b,c', ';')).toBe('"a;b,c"');
    expect(csvCell('line one\r\nline two', ',')).toBe('"line one\r\nline two"');
  });

  it.each(['=1+1', '+39 333 1234567', '-2+3', '@SUM(A1)', '\t=1', '\r=1'])('writes %j with a quote in front, so that it is not read as a formula', (text) => {
    expect(csvCell(text, ';')).toBe(`"'${text}"`);
  });

  it('writes the HYPERLINK of an attacker as text', () => {
    expect(csvCell('=HYPERLINK("http://evil.example","clicca")', ';')).toBe(`"'=HYPERLINK(""http://evil.example"",""clicca"")"`);
  });

  it('does not touch a text that only has such a character inside', () => {
    expect(csvCell('a=b', ';')).toBe('"a=b"');
    expect(csvCell('Mario - Rossi', ';')).toBe('"Mario - Rossi"');
  });

  it('writes a number as a number, even a negative one, with the decimal comma where `;` separates', () => {
    expect(csvCell(450, ';')).toBe('"450"');
    expect(csvCell(-12, ';')).toBe('"-12"');
    expect(csvCell(380.5, ';')).toBe('"380,5"');
    expect(csvCell(380.5, ',')).toBe('"380.5"');
    expect(csvCell(Number.NaN, ';')).toBe('""');
    expect(csvCell(Number.POSITIVE_INFINITY, ';')).toBe('""');
  });
});

describe('buildCsv', () => {
  it('starts with the byte order mark, has the header first and ends the lines with CRLF', () => {
    const csv = buildCsv(['Name', 'Total'], [['Mario', 10], ['Anna', 5.5]], ';');

    expect(csv).toBe(`${BOM}"Name";"Total"\r\n"Mario";"10"\r\n"Anna";"5,5"`);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it('protects the header too', () => {
    expect(buildCsv(['=bad'], [], ',')).toBe(`${BOM}"'=bad"`);
  });
});

describe('the separator', () => {
  it('is `;` in Italian and `,` in any other language, unless the list says otherwise', () => {
    const list = stayList();

    expect(csvSeparatorFor(list, 'it')).toBe(';');
    expect(csvSeparatorFor(list, 'it-IT')).toBe(';');
    expect(csvSeparatorFor(list, 'en')).toBe(',');
    expect(csvSeparatorFor(stayList({ extra: { csv: { separator: ',' } } }), 'it')).toBe(',');
    expect(csvSeparatorFor(stayList({ extra: { csv: { separator: ';' } } }), 'en')).toBe(';');
    expect(csvSeparatorFor(stayList({ extra: { csv: false } }), 'it')).toBe(';');
  });
});

describe('what a column puts in the file', () => {
  const list = stayList();
  const column = (id: string) => list.columns.find((candidate) => candidate.id === id)!;

  it('uses `csv` when the column has it', () => {
    expect(columnCsvValue(column('status'), STAYS[0])).toBe('Pending');
    expect(columnCsvValue(column('total'), STAYS[1])).toBe(380.5);
  });

  it('uses the cell when it is text or a number', () => {
    expect(columnCsvValue(column('guest'), STAYS[0])).toBe('Mario Rossi');
    expect(columnCsvValue(column('email'), STAYS[0])).toBe('mario@example.com');
  });

  it('falls back to the value the column sorts by when the cell is made of components, and to nothing without one', () => {
    const made = { id: 'made', label: 'Made', render: () => <b>x</b>, sort: () => 'sorted' };
    const nothing = { id: 'nothing', label: 'Nothing', render: () => <b>x</b> };

    expect(columnCsvValue(made, STAYS[0])).toBe('sorted');
    expect(columnCsvValue(nothing, STAYS[0])).toBe('');
  });
});

describe('listToCsv', () => {
  it('writes the columns the person sees, with their titles, for the rows given', () => {
    const list = stayList();
    const columns = visibleColumns(list, ['guest', 'dates', 'channel', 'status', 'total', 'email']);
    const csv = listToCsv(columns, [STAYS[0], STAYS[1]], ';');

    expect(csv).toBe(`${BOM}"Guest";"Dates";"Channel";"Status";"Total";"Email"\r\n"Mario Rossi";"2026-10-12 → 2026-10-15";"direct";"Pending";"450";"mario@example.com"\r\n"Anna Bianchi";"2026-10-10 → 2026-10-13";"airbnb";"Confirmed";"380,5";"anna@example.com"`);
  });

  it('protects a guest whose name is a formula', () => {
    const csv = listToCsv(visibleColumns(stayList(), null), [STAYS[4]], ',');

    expect(csv).toContain(`"'=HYPERLINK(""http://evil.example"",""clicca"")"`);
    expect(csv).not.toContain(`,"=HYPERLINK`);
  });
});

describe('the file', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is named after the list and the day in Rome (a late evening in UTC is already tomorrow there)', () => {
    expect(csvFileName(stayList(), new Date('2026-10-09T10:00:00Z'))).toBe('stays-2026-10-09.csv');
    expect(csvFileName(stayList(), new Date('2026-10-09T23:30:00Z'))).toBe('stays-2026-10-10.csv');
    expect(csvFileName(stayList({ extra: { csv: { fileName: 'prenotazioni' } } }), new Date('2026-10-09T10:00:00Z'))).toBe('prenotazioni-2026-10-09.csv');
  });

  it('is saved as UTF-8 text through the browser', async () => {
    let saved: Blob | undefined;
    let savedName: string | undefined;
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        saved = blob;
        return 'blob:test';
      },
      revokeObjectURL: () => undefined,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      savedName = this.download;
    });

    downloadCsv('stays-2026-10-09.csv', `${BOM}"a"`);

    expect(savedName).toBe('stays-2026-10-09.csv');
    expect(saved?.type).toBe('text/csv;charset=utf-8');
    // The bytes of the file start with the byte order mark of UTF-8 (EF BB BF), which `Blob.text()` would hide.
    const bytes = new Uint8Array((await saved?.arrayBuffer()) ?? new ArrayBuffer(0));
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toBe('"a"');
  });
});
