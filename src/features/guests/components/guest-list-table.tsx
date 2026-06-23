import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate } from '@/lib/utils';
import type { Guest } from '@/types';

interface GuestListTableProps {
  guests: Guest[];
}

export function GuestListTable({ guests }: GuestListTableProps) {
  const { t } = useTranslation();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              {t('guests.anagrafica')}
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Città
            </th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">
              Data Creazione
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground" />
          </tr>
        </thead>
        <tbody>
          {guests.map((guest) => (
            <tr
              key={guest.id}
              className="border-b last:border-0 hover:bg-muted/30 transition-colors"
            >
              <td className="px-4 py-3 font-medium">
                {guest.firstName} {guest.lastName}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{guest.email}</td>
              <td className="px-4 py-3 text-muted-foreground">{guest.city || '—'}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDate(guest.createdAt)}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/app/short-rent/guests/${guest.id}`}
                  className="text-primary hover:underline text-sm font-medium"
                >
                  Dettagli
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
