/** Italian province codes, including the ones abolished in 2016 that still appear on older documents. */
const PROVINCES = [
  'AG', 'AL', 'AN', 'AO', 'AP', 'AQ', 'AR', 'AT', 'AV', 'BA', 'BG', 'BI', 'BL', 'BN', 'BO', 'BR', 'BS', 'BT',
  'BZ', 'CA', 'CB', 'CE', 'CH', 'CI', 'CL', 'CN', 'CO', 'CR', 'CS', 'CT', 'CZ', 'EN', 'FC', 'FE', 'FG', 'FI',
  'FM', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'KR', 'LC', 'LE', 'LI', 'LO', 'LT', 'LU', 'MB', 'MC', 'ME', 'MI',
  'MN', 'MO', 'MS', 'MT', 'NA', 'NO', 'NU', 'OG', 'OR', 'OT', 'PA', 'PC', 'PD', 'PE', 'PG', 'PI', 'PN', 'PO',
  'PR', 'PT', 'PU', 'PV', 'PZ', 'RA', 'RC', 'RE', 'RG', 'RI', 'RM', 'RN', 'RO', 'SA', 'SI', 'SO', 'SP', 'SR',
  'SS', 'SU', 'SV', 'TA', 'TE', 'TN', 'TO', 'TP', 'TR', 'TS', 'TV', 'UD', 'VA', 'VB', 'VC', 'VE', 'VI', 'VR',
  'VS', 'VT', 'VV',
] as const;

const PROVINCE_SET = new Set<string>(PROVINCES);

/** True for a real Italian province code (RM). A region code such as ER is not a province. */
export function isItalianProvince(value: string): boolean {
  return PROVINCE_SET.has(value.trim().toUpperCase());
}
