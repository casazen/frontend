import { AlertTriangle } from 'lucide-react';

export function ExtraEUWarningBanner() {
  return (
    <div
      role="alert"
      className="flex gap-3 rounded-lg border border-amber-500/50 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/20 dark:text-amber-100"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="space-y-1">
        <p className="font-semibold">
          Cessione di fabbricato — Questura notification required
        </p>
        <p className="text-sm">
          This lease includes a tenant with non-EU citizenship. Italian law requires
          notifying the Questura within 48 hours of contract signing. Ensure the
          cessione di fabbricato is filed on time.
        </p>
      </div>
    </div>
  );
}
