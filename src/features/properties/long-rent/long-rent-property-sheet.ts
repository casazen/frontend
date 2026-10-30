/**
 * The tabs of the page of a long-term property (LR-07d), in the order they are shown: its contracts, its documents (the APE the
 * contract states), the requests to suppliers (Interventi) and its data (the place and the cadastral identification). The tab is in
 * the address (`?tab=`), so a link can point at it: `?tab=data` is where the contract wizard sends a landlord to add what is missing.
 */
export type LongRentPropertyPanel = 'contracts' | 'documents' | 'requests' | 'data';

/** The tabs a person sees: the contracts only to who may read them (the list is asked of the server, which narrows it). */
export function longRentPropertyPanels(canReadLeases: boolean): LongRentPropertyPanel[] {
  return canReadLeases ? ['contracts', 'documents', 'requests', 'data'] : ['documents', 'requests', 'data'];
}

/** The tab a `?tab=` opens: an unknown value, or the contracts to who may not read them, opens the first one. */
export function longRentPropertyPanelOf(value: string | null, panels: readonly LongRentPropertyPanel[]): LongRentPropertyPanel {
  return panels.find((panel) => panel === value) ?? panels[0];
}
