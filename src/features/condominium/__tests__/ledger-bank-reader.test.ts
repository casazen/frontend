import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { readBankFile } from '../ledger-bank-reader';
function spreadsheet(rows: unknown[][]): File {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Movimenti');
  const buffer = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return { size: buffer.byteLength, arrayBuffer: async () => buffer } as File;
}
describe('bank statement review data', () => {
  it('accepts EUR debits, preserves dates and gives repeated identical transfers distinct stable identities', async () => {
    const file = spreadsheet([['Data', 'Importo', 'Dettagli', 'Valuta'], ['31/01/2027', -150, 'Condominio', 'EUR'], ['31/01/2027', -150, 'Condominio', 'EUR'], ['01/02/2027', 650, 'Affitto ricevuto', 'EUR'], ['02/02/2027', -50, 'CHF', 'CHF']]);
    const rows = await readBankFile(file);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ date: '2027-01-31', amount: 150 });
    expect(rows[0].id).not.toBe(rows[1].id);
    expect(await readBankFile(file)).toEqual(rows);
  });
  it('rejects invalid dates instead of moving a February payment into March', async () => {
    await expect(readBankFile(spreadsheet([['Data', 'Importo'], ['31/02/2027', -150]]))).rejects.toThrow('Nessun movimento');
  });
});
