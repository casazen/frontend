import { Link } from 'react-router-dom';
import { CinStatusBadge } from '@/features/admin/components/cin-status-badge';
import type { CinComplianceItem } from '@/types/cin.types';

interface CinComplianceTableProps {
  items: CinComplianceItem[];
  isLoading?: boolean;
}

export function CinComplianceTable({ items, isLoading }: CinComplianceTableProps) {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Caricamento...</p>;
  }

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessuna proprietà trovata.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="cin-compliance-table">
        <thead>
          <tr className="border-b bg-muted/40">
            {['Proprietà', 'Città', 'Codice CIN', 'Stato', ''].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.propertyId}
              className="border-b last:border-0 hover:bg-muted/30"
              data-testid={`cin-row-${item.propertyId}`}
            >
              <td className="px-4 py-3 font-medium">{item.propertyName}</td>
              <td className="px-4 py-3 text-muted-foreground">{item.city}</td>
              <td className="px-4 py-3 font-mono text-xs">
                {item.cinCode ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-3">
                <span data-testid="cin-status-badge">
                  <CinStatusBadge status={item.cinStatus} />
                </span>
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/app/short-rent/properties/${item.propertyId}/edit`}
                  className="text-primary hover:underline text-xs"
                >
                  Modifica CIN
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
