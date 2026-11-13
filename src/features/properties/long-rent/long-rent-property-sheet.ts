/**
 * The tabs of the page of a long-term property (LR-07d). Opening the property is where Contratti, Spese condominiali and
 * Manutenzione live. Documenti (the APE), Interventi (requests to suppliers) and Dati stay on the same sheet: the contract
 * wizard still sends a landlord to `?tab=data` for the cadastral identification. Canoni are not a tab here.
 */
export type LongRentPropertyPanel = 'contracts' | 'expenses' | 'maintenance' | 'documents' | 'requests' | 'data';

/** Expenses belong to the property. Only contracts and tenant maintenance require lease access. */
export function longRentPropertyPanels(canReadLeases: boolean): LongRentPropertyPanel[] {
  return canReadLeases
    ? ['contracts', 'expenses', 'maintenance', 'documents', 'requests', 'data']
    : ['expenses', 'documents', 'requests', 'data'];
}

/** The tab a `?tab=` opens: an unknown value, or the contracts to who may not read them, opens the first one. */
export function longRentPropertyPanelOf(value: string | null, panels: readonly LongRentPropertyPanel[]): LongRentPropertyPanel {
  return panels.find((panel) => panel === value) ?? panels[0];
}
