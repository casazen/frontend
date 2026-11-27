export type LongRentPropertyPanel = 'contracts' | 'expenses' | 'maintenance' | 'documents' | 'requests' | 'data';

export function longRentPropertyPanels(canReadLeases: boolean): LongRentPropertyPanel[] {
  return canReadLeases
    ? ['contracts', 'expenses', 'maintenance', 'documents', 'requests', 'data']
    : ['expenses', 'documents', 'requests', 'data'];
}

export function longRentPropertyPanelOf(value: string | null, panels: readonly LongRentPropertyPanel[]): LongRentPropertyPanel {
  return panels.find((panel) => panel === value) ?? panels[0];
}
