import { BookOpen, CircleHelp, LayoutGrid, ListChecks, Route, Type, type LucideIcon } from 'lucide-react';
import type { ManualEntryType } from './manual-search';

export const MANUAL_TYPE_ICONS: Record<ManualEntryType, LucideIcon> = {
  pagina: BookOpen,
  howto: ListChecks,
  funzione: LayoutGrid,
  faq: CircleHelp,
  flusso: Route,
  termine: Type,
};
