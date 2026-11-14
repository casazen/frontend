import type { BillingSetup, BillingSetupItem, BillingSetupSection, FiscalIssuerPreview, FiscalTaxRule } from '@/types';

/** One section of the setup, with what is saved in it and what is missing. */
export function section(name: string, values: Record<string, unknown>, missing: BillingSetupItem[] = [], applies = true): BillingSetupSection {
  return { section: name, applies, complete: missing.length === 0, values, missing };
}

export function item(key: string, sectionName: string, reason = 'required', count?: number): BillingSetupItem {
  return count === undefined ? { key, section: sectionName, reason } : { key, section: sectionName, reason, count };
}

/** The setup as the server sends it: every section in the order of the wizard, with its values, and the rest of the sections as they are for an organization that is no agency. */
export function setupOf(sections: BillingSetupSection[]): BillingSetup {
  return { complete: sections.every((entry) => entry.complete), sections };
}

const DEFAULTS = { defaultGuestDocumentSeries: '{year}', defaultOwnerInvoiceSeries: 'PM{year}' };

/** A Swiss issuer that has said everything but who collects the tourist tax and how the documents are issued. */
export function swissSetup(): BillingSetup {
  return setupOf([
    section('issuer', { countryCode: 'CH', legalName: 'Casa Lugano SA', addressStreet: 'Via Nassa', addressCivic: '12', postalCode: '6900', city: 'Lugano', province: 'TI' }),
    section('vat', {
      regime: 'SwissVatRegistered',
      vatRegistered: true,
      swissVatNumber: 'CHE-123.456.789',
      stayVatTreatment: 'Standard',
      cleaningFeeTreatment: 'FollowsStay',
    }),
    section('numbering', { guestDocumentSeries: '{year}', ownerInvoiceSeries: 'PM{year}', ...DEFAULTS }),
    section('touristTax', { confirmed: false }, [item('tourist_tax_channels_unconfirmed', 'touristTax', 'unconfirmed')]),
    section('channels', {}, [], false),
    section('mandates', {}, [], false),
    section('automation', { autoIssueGuestDocuments: false, emailGuestDocuments: false }, [item('auto_issue_unconfirmed', 'automation', 'unconfirmed')]),
    section('italy', {}, [], false),
  ]);
}

/** An Italian issuer, a private person, that has said everything. */
export function italianSetup(): BillingSetup {
  return setupOf([
    section('issuer', { countryCode: 'IT', legalName: 'Mario Rossi', addressStreet: 'Via Roma', addressCivic: '1', postalCode: '20121', city: 'Milano', province: 'MI', fiscalCode: 'RSSMRA80A01F205X' }),
    section('vat', { regime: 'PrivatePerson', vatRegistered: false, stayVatTreatment: 'Standard', cleaningFeeTreatment: 'FollowsStay' }),
    section('numbering', { guestDocumentSeries: '{year}', ownerInvoiceSeries: 'PM{year}', ...DEFAULTS }),
    section('touristTax', {}, [], false),
    section('channels', {}, [], false),
    section('mandates', {}, [], false),
    section('automation', { autoIssueGuestDocuments: false, emailGuestDocuments: false }),
    section('italy', { conservationAgreementConfirmed: true, virtualStampConfirmed: true }),
  ]);
}

/** A setup in which the issuer has not said a country yet: the server answers its default country, and the country is still a missing item. */
export function emptySetup(): BillingSetup {
  return setupOf([
    section('issuer', { countryCode: 'IT' }, [item('country_missing', 'issuer'), item('legal_name_missing', 'issuer'), item('address_missing', 'issuer')]),
    section('vat', {}, [item('regime_missing', 'vat')]),
    section('numbering', { ...DEFAULTS }, [item('guest_series_unconfirmed', 'numbering', 'unconfirmed'), item('owner_series_unconfirmed', 'numbering', 'unconfirmed')]),
    section('touristTax', {}, [], false),
    section('channels', {}, [], false),
    section('mandates', {}, [], false),
    section('automation', {}, [item('auto_issue_unconfirmed', 'automation', 'unconfirmed')]),
    section('italy', {}, [], false),
  ]);
}

/** The Swiss rule in force (VAT 2024: stay 3.8%, services 8.1%): the rates the catalog of the server holds, as `issuer-preview` sends them. */
export const SWISS_RULE: FiscalTaxRule = {
  jurisdiction: 'CH',
  regime: 'SwissVatRegistered',
  version: 'CH-2024-01-01',
  validFrom: '2024-01-01',
  documentKind: 'Invoice',
  rates: [
    { lineType: 'Accommodation', percent: 3.8 },
    { lineType: 'Cleaning', percent: 3.8 },
    { lineType: 'ExtraService', percent: 8.1 },
    { lineType: 'TouristTax', percent: 0 },
  ],
};

/** The Italian rule of a private person: no VAT, the nature code of the exempt amounts and the stamp duty of the receipt. */
export const ITALIAN_RULE: FiscalTaxRule = {
  jurisdiction: 'IT',
  regime: 'PrivatePerson',
  version: 'IT-2026-01-01',
  validFrom: '2026-01-01',
  documentKind: 'Receipt',
  rates: [
    { lineType: 'Accommodation', percent: 0, natureCode: 'N2.2' },
    { lineType: 'Cleaning', percent: 0, natureCode: 'N2.2' },
  ],
  stampDuty: { threshold: 77.47, amount: 2, chargedToRecipient: true },
};

export function previewOf(rule: FiscalTaxRule | undefined): FiscalIssuerPreview {
  return { issuer: 'CasaZen', reason: 'issuer_casazen', ...(rule ? { rule } : {}) };
}
