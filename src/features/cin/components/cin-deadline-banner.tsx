import { AlertTriangle } from 'lucide-react';
import type { CinComplianceSummary } from '@/types/cin.types';

interface CinDeadlineBannerProps {
  summary: CinComplianceSummary;
}

export function CinDeadlineBanner({ summary }: CinDeadlineBannerProps) {
  if (!summary.hasNonCompliant)
    return null;

  const days = summary.daysUntilDeadline;
  const deadlineLabel = days === 0
    ? 'la scadenza è oggi'
    : `mancano ${days} giorni alla scadenza del ${summary.deadline}`;

  return (
    <div
      role="alert"
      data-testid="cin-deadline-banner"
      className="flex gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="space-y-1">
        <p className="font-semibold">Conformità CIN richiesta (D.L. 145/2023)</p>
        <p className="text-sm">
          Hai {summary.missing + summary.invalid} proprietà senza CIN valido.
          {' '}
          {deadlineLabel}.
          {' '}
          Sanzioni da €800 a €8.000 per immobile.
          {' '}
          <a
            href="https://bdsr.ministeroturismo.it"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            Richiedi il CIN su BDSR
          </a>
        </p>
      </div>
    </div>
  );
}
