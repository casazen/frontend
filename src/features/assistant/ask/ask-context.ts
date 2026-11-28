import { createContext } from 'react';

export type AskIntent = 'search' | 'arrivals.incompleteToday' | 'booking.prepareMessage';

export interface AskContextValue {
  canReadArrivals: boolean;
  canPrepareDraft: boolean;
  open: (intent: AskIntent, from: HTMLElement, question?: string) => void;
}

export const AskContext = createContext<AskContextValue | null>(null);
