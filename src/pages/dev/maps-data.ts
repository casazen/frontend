import type { LatLon } from '@/features/site-maps';

export interface House extends LatLon {
  id: string;
  name: string;
  /** Names of the towns to emphasise. */
  near: string[];
}

/** Houses for the review: positions with two decimals, as the server publishes them. The first ones are in Lombardia and Svizzera, where the site works. */
export const HOUSES: House[] = [
  { id: 'bellagio', name: 'Villa a Bellagio', lat: 45.99, lon: 9.26, near: [] },
  { id: 'como', name: 'Attico a Como', lat: 45.81, lon: 9.08, near: ['como'] },
  { id: 'milano', name: 'Loft a Milano', lat: 45.47, lon: 9.19, near: [] },
  { id: 'bergamo', name: 'Casa in Città Alta', lat: 45.71, lon: 9.67, near: [] },
  { id: 'sirmione', name: 'Casa a Sirmione', lat: 45.49, lon: 10.61, near: [] },
  { id: 'iseo', name: 'Casa sul lago d’Iseo', lat: 45.66, lon: 10.05, near: [] },
  { id: 'luino', name: 'Casa sul Lago Maggiore', lat: 46.0, lon: 8.75, near: [] },
  { id: 'lugano', name: 'Appartamento a Lugano', lat: 46.01, lon: 8.96, near: ['lugano'] },
  { id: 'locarno', name: 'Casa a Locarno', lat: 46.17, lon: 8.8, near: [] },
  { id: 'zurigo', name: 'Loft a Zurigo', lat: 47.37, lon: 8.54, near: [] },
  { id: 'ginevra', name: 'Casa a Ginevra', lat: 46.2, lon: 6.15, near: [] },
  { id: 'montreux', name: 'Casa a Montreux', lat: 46.43, lon: 6.91, near: [] },
  { id: 'lucerna', name: 'Casa sul lago di Lucerna', lat: 47.05, lon: 8.31, near: [] },
  { id: 'zermatt', name: 'Chalet a Zermatt', lat: 46.02, lon: 7.75, near: [] },
  { id: 'moritz', name: 'Chalet a St. Moritz', lat: 46.49, lon: 9.84, near: [] },
  { id: 'orcia', name: 'Podere in Val d’Orcia', lat: 43.06, lon: 11.67, near: [] },
  { id: 'chianti', name: 'Casale nel Chianti', lat: 43.47, lon: 11.25, near: [] },
  { id: 'cinque', name: 'Casa alle Cinque Terre', lat: 44.12, lon: 9.71, near: [] },
  { id: 'cortina', name: 'Chalet a Cortina', lat: 46.54, lon: 12.14, near: [] },
  { id: 'venezia', name: 'Appartamento a Venezia', lat: 45.44, lon: 12.33, near: [] },
  { id: 'amalfi', name: 'Terrazza ad Amalfi', lat: 40.63, lon: 14.6, near: [] },
  { id: 'roma', name: 'Attico a Roma', lat: 41.9, lon: 12.5, near: [] },
  { id: 'taormina', name: 'Casa a Taormina', lat: 37.85, lon: 15.29, near: [] },
  { id: 'trapani', name: 'Baglio a Trapani', lat: 38.02, lon: 12.51, near: [] },
  { id: 'smeralda', name: 'Villa in Costa Smeralda', lat: 41.14, lon: 9.52, near: [] },
  { id: 'alghero', name: 'Casa ad Alghero', lat: 40.56, lon: 8.32, near: [] },
];

/** The ids of the houses in Lombardia and Svizzera. */
export const HOME_IDS = HOUSES.slice(0, 15).map((h) => h.id);
