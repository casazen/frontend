import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';

// Status labels are now resolved via getAlloggiatiStatusLabel() from @/lib/i18n-labels.
// See alloggiati.status.{key} entries in locale JSONs.

/** Returns an i18n-translated label for an Alloggiati Web report status. */
export function getAlloggiatiStatusLabel(status: AlloggiatiWebStatus, isOverdue = false): string {
  // This function is kept for backward compatibility with non-React consumers.
  // React components should use getAlloggiatiStatusLabel() from @/lib/i18n-labels
  // which takes a TFunction parameter.
  if (isOverdue) return 'Scaduto';
  const fallbacks: Record<AlloggiatiWebStatus, string> = {
    Pending: 'In attesa',
    Submitted: 'Inviato',
    Confirmed: 'Confermato',
    Failed: 'Errore',
  };
  return fallbacks[status] ?? fallbacks.Pending;
}

// Badge variant map moved inline to alloggiati-status-badge.tsx
