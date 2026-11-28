import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { formatStayDate } from '@/lib/stay-dates';
import type { GuestRegisterPeriod } from '@/types/guest-register.types';
import type { GuestRegisterTable } from '../lib/guest-register-model';
import './guest-register-print.css';

interface GuestRegisterSheetProps {
  table: GuestRegisterTable;
  propertyName: string;
  period: GuestRegisterPeriod;
}

/**
 * The register as a sheet to print (E31/F02/US02/T01, NF-130): the name of the property and the period in the header, then the table with the columns of the file and, last, the empty
 * column where each guest signs. It is a child of `body` of its own and shows only to the printer (`guest-register-print.css`): it holds the personal data of the guests, so it is in the page
 * only while the browser prints, and the layer takes it away when the print is over or it is closed. It is the host's own record: CasaZen gives no legal advice.
 */
export function GuestRegisterSheet({ table, propertyName, period }: GuestRegisterSheetProps) {
  const { t, i18n } = useTranslation();
  const day = (value: string) => formatStayDate(value, i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }) || value;
  const last = table.header.length - 1;

  return createPortal(
    <div className="guest-register-sheet" data-testid="guest-register-sheet">
      <h1>{t('guestRegister.print.title')}</h1>
      <p data-testid="guest-register-sheet-property">{propertyName}</p>
      <p data-testid="guest-register-sheet-period">{t('guestRegister.print.period', { from: day(period.from), to: day(period.to) })}</p>
      <table>
        <thead>
          <tr>
            {table.header.map((name, column) => (
              <th key={column} scope="col" className={column === last ? 'guest-register-signature' : undefined} data-testid={column === last ? 'guest-register-signature-header' : undefined}>
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, line) => (
            <tr key={line}>
              {row.map((cell, column) => (
                <td key={column} className={column === last ? 'guest-register-signature' : undefined}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
