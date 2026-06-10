import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';

export const ALLOGGIATI_STATUS_LABELS: Record<AlloggiatiWebStatus, string> = {
  Pending: 'In attesa',
  Submitted: 'Inviato',
  Confirmed: 'Confermato',
  Failed: 'Errore',
};

export function getAlloggiatiStatusLabel(status: AlloggiatiWebStatus, isOverdue = false): string {
  if (isOverdue) return 'Scaduto';
  return ALLOGGIATI_STATUS_LABELS[status] ?? ALLOGGIATI_STATUS_LABELS.Pending;
}

export const ALLOGGIATI_STATUS_VARIANTS: Record<
  AlloggiatiWebStatus,
  'default' | 'secondary' | 'success' | 'destructive' | 'warning' | 'outline'
> = {
  Pending: 'secondary',
  Submitted: 'warning',
  Confirmed: 'success',
  Failed: 'destructive',
};
