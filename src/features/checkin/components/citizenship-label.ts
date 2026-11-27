/**
 * Citizenship adjective for a country name from the Alloggiati table (ITALIA → Italiano).
 * Unknown countries stay as written: the official code is never invented here.
 */
const ADJECTIVE: Record<string, string> = {
  ITALIA: 'Italiano',
  FRANCIA: 'Francese',
  GERMANIA: 'Tedesca',
  SPAGNA: 'Spagnola',
  REGNOUNITO: 'Britannica',
  STATIUNITI: 'Statunitense',
  STATIUNITIDAMERICA: 'Statunitense',
  SVIZZERA: 'Svizzera',
  AUSTRIA: 'Austriaca',
  BELGIO: 'Belga',
  PAESIBASSI: 'Olandese',
  OLANDA: 'Olandese',
  PORTOGALLO: 'Portoghese',
  GRECIA: 'Greca',
  POLONIA: 'Polacca',
  ROMANIA: 'Rumena',
  ALBANIA: 'Albanese',
  UCRAINA: 'Ucraina',
  SANMARINO: 'Sammarinese',
  CINA: 'Cinese',
};

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** What the citizenship field shows. A known country becomes its adjective; anything else is unchanged. */
export function citizenshipAdjective(name: string): string {
  const key = normalize(name);
  return ADJECTIVE[key] ?? name;
}
