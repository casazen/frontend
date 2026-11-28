import type {
  TicinoPropertyCount,
  TicinoYearlyCount,
  TouristTaxAgentAccount,
  TouristTaxAgentAccountRow,
  TouristTaxDeclaration,
  TouristTaxReasonCount,
  TouristTaxSummary,
} from '@/types';

/**
 * The summary of a whole year as the server sends it to who reaches every property: 32.345,50 owed, 20.000,00 remitted, 12.345,50 left. Every figure has five digits, so that the grouping of the language shows in it, and the
 * cents are the server's own (`*Cents`): the page writes them and adds nothing up.
 */
export function summaryOf(year: number, change: Partial<TouristTaxSummary> = {}): TouristTaxSummary {
  return {
    title: 'Imposta di soggiorno per comune',
    basis: 'recorded',
    currency: 'EUR',
    paymentsHidden: false,
    period: { from: `${year}-01-01`, to: `${year}-12-31` },
    comuni: [
      {
        comune: 'Milano',
        stays: 4,
        nights: 9,
        guests: 8,
        owed: 32345.5,
        owedCents: 3234550,
        staysWithoutAmount: 0,
        paid: 20000,
        paidCents: 2000000,
        balance: 12345.5,
        balanceCents: 1234550,
        status: 'ToPay',
        remittances: [],
      },
    ],
    total: { stays: 4, nights: 9, guests: 8, owed: 32345.5, owedCents: 3234550, staysWithoutAmount: 0, paid: 20000, paidCents: 2000000, balance: 12345.5, balanceCents: 1234550 },
    ...change,
  };
}

export const EXEMPTIONS_WITH_REASONS: TouristTaxReasonCount[] = [
  { reason: 'minor_age', stays: 1, guests: 1, guestNights: 3 },
  { reason: 'health_care', stays: 1, guests: 1, guestNights: 3 },
  { reason: 'resident', stays: 1, guests: 2, guestNights: 2 },
  { reason: 'erased', stays: 1, guests: 1, guestNights: 2 },
];

/** The same exempt guests as the server gives them to everybody else (art. 9 GDPR): the age, and one row that counts the others. No reason anywhere. */
export const EXEMPTIONS_RESTRICTED: TouristTaxReasonCount[] = [
  { reason: 'minor_age', stays: 1, guests: 1, guestNights: 3 },
  { reason: 'restricted', stays: 3, guests: 4, guestNights: 7 },
];

export const SENSITIVE_REASON_CODES = ['resident', 'health_care', 'disability_companion', 'public_service', 'host_family', 'other', 'erased'];

/**
 * The declaration to the comuni as the server sends it to who reaches every property: Milano (the summary of the year above, 3 stays with a tax and 1 without, 4 exempt guests of which one erased) and Roma (paid in full, no
 * exemption), and the totals as the server adds them up. The figures of the year-end have five digits or fewer than four, so that the grouping of the language shows in them (Italian does not group four digits: «1200,00 €»).
 */
export function declarationOf(year: number, change: Partial<TouristTaxDeclaration> = {}, exemptions: TouristTaxReasonCount[] = EXEMPTIONS_WITH_REASONS): TouristTaxDeclaration {
  const milano = summaryOf(year).comuni[0]!;
  return {
    year,
    currency: 'EUR',
    comuni: [
      {
        summary: { ...milano, staysWithoutAmount: 1 },
        taxedStays: 3,
        staysWithoutAmount: [{ reason: 'exempt', stays: 1, guests: 2, guestNights: 4 }],
        exemptions,
      },
      {
        summary: {
          comune: 'Roma',
          stays: 2,
          nights: 5,
          guests: 4,
          owed: 12000,
          owedCents: 1200000,
          staysWithoutAmount: 0,
          paid: 12000,
          paidCents: 1200000,
          balance: 0,
          balanceCents: 0,
          status: 'Paid',
          remittances: [],
        },
        taxedStays: 2,
        staysWithoutAmount: [],
        exemptions: [],
      },
    ],
    total: { stays: 6, nights: 14, guests: 12, owed: 44345.5, owedCents: 4434550, staysWithoutAmount: 1, paid: 32000, paidCents: 3200000, balance: 12345.5, balanceCents: 1234550 },
    ...change,
  };
}

function accountRow(year: number, change: Partial<TouristTaxAgentAccountRow>): TouristTaxAgentAccountRow {
  return {
    comune: 'Milano',
    period: `${year}-03`,
    from: `${year}-03-01`,
    to: `${year}-03-31`,
    isYear: false,
    stays: 2,
    nights: 5,
    guests: 4,
    collected: 12345.5,
    staysWithoutAmount: 0,
    remitted: 345.5,
    balance: 12000,
    ...change,
  };
}

export function agentAccountOf(year: number, by: 'month' | 'quarter' = 'month', change: Partial<TouristTaxAgentAccount> = {}): TouristTaxAgentAccount {
  const second = { collected: 20000, staysWithoutAmount: 1, remitted: 19654.5, balance: 345.5 };
  const periods =
    by === 'quarter'
      ? [accountRow(year, { period: `${year}-Q1`, from: `${year}-01-01`, to: `${year}-03-31` }), accountRow(year, { period: `${year}-Q2`, from: `${year}-04-01`, to: `${year}-06-30`, ...second })]
      : [accountRow(year, {}), accountRow(year, { period: `${year}-04`, from: `${year}-04-01`, to: `${year}-04-30`, ...second })];
  return {
    year,
    by: by === 'quarter' ? 'Quarter' : 'Month',
    currency: 'EUR',
    rows: [
      ...periods,
      accountRow(year, { period: `${year}`, from: `${year}-01-01`, to: `${year}-12-31`, isYear: true, stays: 4, nights: 9, guests: 8, collected: 32345.5, staysWithoutAmount: 1, remitted: 20000, balance: 12345.5 }),
      accountRow(year, { comune: 'Roma', period: `${year}`, from: `${year}-01-01`, to: `${year}-12-31`, isYear: true, stays: 2, nights: 5, guests: 4, collected: 12000, remitted: 12000, balance: 0 }),
    ],
    remittances: [
      { id: 'r-1', comune: 'Milano', periodFrom: `${year}-03-01`, periodTo: `${year}-03-31`, amount: 345.5, amountCents: 34550, paidOn: `${year}-04-05`, reference: null, notes: null, hasReceipt: false },
      { id: 'r-2', comune: 'Milano', periodFrom: `${year}-04-01`, periodTo: `${year}-04-30`, amount: 19654.5, amountCents: 1965450, paidOn: `${year}-05-06`, reference: 'F24-0001', notes: null, hasReceipt: true },
      { id: 'r-3', comune: 'Roma', periodFrom: `${year}-01-01`, periodTo: `${year}-12-31`, amount: 12000, amountCents: 1200000, paidOn: `${year}-12-20`, reference: null, notes: null, hasReceipt: false },
    ],
    total: { stays: 6, nights: 14, guests: 12, owed: 44345.5, owedCents: 4434550, staysWithoutAmount: 1, paid: 32000, paidCents: 3200000, balance: 12345.5, balanceCents: 1234550 },
    ...change,
  };
}

export function ticinoProperty(change: Partial<TicinoPropertyCount> = {}): TicinoPropertyCount {
  return {
    propertyId: 'p-lugano',
    propertyName: 'Casa Lugano',
    address: 'Via Nassa 1',
    city: 'Lugano',
    municipalityCode: '5192',
    currency: 'CHF',
    stays: 3,
    nights: 12,
    taxedStays: 2,
    taxedNights: 9,
    untaxedStays: 1,
    untaxedNights: 3,
    staysWithoutDocument: 0,
    nightsWithoutDocument: 0,
    touristTax: 12345.5,
    cantonUnknown: false,
    ...change,
  };
}

export function ticinoUnknownProperty(change: Partial<TicinoPropertyCount> = {}): TicinoPropertyCount {
  return ticinoProperty({
    propertyId: 'p-chiasso',
    propertyName: 'Villa Senza Comune',
    address: 'Via Prova 2',
    city: 'Chiasso',
    municipalityCode: null,
    stays: 1,
    nights: 2,
    taxedStays: 0,
    taxedNights: 0,
    untaxedStays: 0,
    untaxedNights: 0,
    staysWithoutDocument: 1,
    nightsWithoutDocument: 2,
    touristTax: 0,
    cantonUnknown: true,
    ...change,
  });
}

export function ticinoOf(year: number, change: Partial<TicinoYearlyCount> = {}): TicinoYearlyCount {
  return { year, dueDate: `${year + 1}-01-05`, cantonUnknownCount: 0, properties: [ticinoProperty()], ...change };
}

/**
 * What the server answers to the JSON read of a year-end result (`?format=json`), by its address: the declaration, the account of the agent in the cut asked for, or the count of Ticino. The reasons of the exemptions are
 * those of a caller who holds `guest.read` unless the test says otherwise.
 */
export function yearEndJsonOf(path: string, params: Record<string, string> | undefined): unknown {
  const [, , , year, kind] = path.split('/');
  switch (kind) {
    case 'declaration':
      return declarationOf(Number(year));
    case 'agent-account':
      return agentAccountOf(Number(year), params?.by === 'quarter' ? 'quarter' : 'month');
    case 'ticino':
      return ticinoOf(Number(year));
    default:
      throw new Error(`unexpected year-end read: ${path}`);
  }
}
