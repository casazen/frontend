import type { LatLon } from '@/features/site-maps';

export interface House extends LatLon {
  id: string;
  name: string;
  /** Names of the towns to emphasise. */
  near: string[];
}

/** Houses for the review: positions with two decimals, as the server publishes them. */
export const HOUSES: House[] = [
  { id: 'trullo', name: 'Trullo tra gli ulivi', lat: 40.76, lon: 17.54, near: ['ostuni'] },
  { id: 'polignano', name: 'Casa sul mare', lat: 41.0, lon: 17.23, near: ['polignano-a-mare'] },
  { id: 'lecce', name: 'Attico nel centro', lat: 40.35, lon: 18.17, near: ['lecce'] },
  { id: 'gargano', name: 'Villa sul Gargano', lat: 41.88, lon: 16.18, near: ['vieste'] },
  { id: 'orcia', name: 'Podere in Val d’Orcia', lat: 43.06, lon: 11.67, near: [] },
  { id: 'chianti', name: 'Casale nel Chianti', lat: 43.47, lon: 11.25, near: [] },
  { id: 'cinque', name: 'Casa alle Cinque Terre', lat: 44.12, lon: 9.71, near: [] },
  { id: 'como', name: 'Villa sul lago di Como', lat: 45.99, lon: 9.26, near: [] },
  { id: 'cortina', name: 'Chalet a Cortina', lat: 46.54, lon: 12.14, near: [] },
  { id: 'venezia', name: 'Appartamento a Venezia', lat: 45.44, lon: 12.33, near: [] },
  { id: 'amalfi', name: 'Terrazza ad Amalfi', lat: 40.63, lon: 14.6, near: [] },
  { id: 'roma', name: 'Attico a Roma', lat: 41.9, lon: 12.5, near: [] },
  { id: 'taormina', name: 'Casa a Taormina', lat: 37.85, lon: 15.29, near: [] },
  { id: 'trapani', name: 'Baglio a Trapani', lat: 38.02, lon: 12.51, near: [] },
  { id: 'smeralda', name: 'Villa in Costa Smeralda', lat: 41.14, lon: 9.52, near: [] },
  { id: 'alghero', name: 'Casa ad Alghero', lat: 40.56, lon: 8.32, near: [] },
  { id: 'tropea', name: 'Casa a Tropea', lat: 38.68, lon: 15.9, near: [] },
  { id: 'ancona', name: 'Casa nel Conero', lat: 43.55, lon: 13.6, near: [] },
];
