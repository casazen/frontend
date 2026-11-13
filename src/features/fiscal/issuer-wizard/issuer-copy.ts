import type { TFunction } from 'i18next';
import type { DocumentIssuerMode, DocumentRegime, FiscalDocumentRule, FiscalDocumentSettings } from '@/types';
import { regimeHasVatNumber } from './issuer-wizard-schema';

/** The words for who issues, in the summary and in the confirmation. The channel manager is never named (NF-12). */
export const MODE_LABEL_KEYS: Readonly<Record<DocumentIssuerMode, string>> = {
  Octorate: 'fiscalDocuments.issuer.labels.mode.Octorate',
  CasaZenDirectOnly: 'fiscalDocuments.issuer.labels.mode.CasaZenDirectOnly',
  Accountant: 'fiscalDocuments.issuer.labels.mode.Accountant',
};

/** The words for the regime of the issuer. */
export const REGIME_LABEL_KEYS: Readonly<Record<DocumentRegime, string>> = {
  PrivatePerson: 'fiscalDocuments.issuer.labels.regime.PrivatePerson',
  VatOrdinary: 'fiscalDocuments.issuer.labels.regime.VatOrdinary',
  VatFlatRate: 'fiscalDocuments.issuer.labels.regime.VatFlatRate',
};

interface EffectsInput {
  mode: DocumentIssuerMode;
  regime: DocumentRegime | null;
  settings: Pick<FiscalDocumentSettings, 'regime' | 'rule' | 'sdi'>;
}

/**
 * Whether the document of the regime is an electronic invoice (a file for the SDI) or a receipt, or not known yet: what the rule of the regime
 * says once the accountant has decided it, else what the regime is (a VAT number has the invoice, a private person has no electronic invoice).
 */
function hasElectronicInvoice(regime: DocumentRegime | null, rule: FiscalDocumentRule | undefined): boolean | null {
  switch (rule?.documentKind) {
    case 'Invoice':
    case 'DualHeadingInvoice':
      return true;
    case 'Receipt':
      return false;
    default:
      return regime === null ? null : regimeHasVatNumber(regime);
  }
}

/**
 * What the choice means in plain words, one sentence for each thing CasaZen will and will not do (NF-05). Only what is true today:
 *
 * - a booking has one issuer: where the channel manager issues CasaZen never does, and CasaZen never issues for a booking that comes from a
 *   portal, in any mode (the server refuses it);
 * - the electronic invoice is not sent to the SDI by CasaZen while the server has no channel for it (`sdi.providerConfigured`): the file is
 *   downloaded. This is said only where there is an electronic invoice: a regime whose document is a receipt (a private person) has no file
 *   and nothing to send, and says so;
 * - nothing is issued while the document of the regime is not confirmed (`document_rule_not_configured`): the rule of the regime is known
 *   only for the regime the server has, so for another one the sentence stays a condition.
 *
 * The same sentences read as «what will happen» before the last button and as «what happens now» after it.
 */
export function effectsOf(t: TFunction, { mode, regime, settings }: EffectsInput): string[] {
  const lines: string[] = [];

  switch (mode) {
    case 'Octorate':
      lines.push(t('fiscalDocuments.issuer.effects.octorate.issues'));
      lines.push(t('fiscalDocuments.issuer.effects.octorate.oneIssuer'));
      lines.push(t('fiscalDocuments.issuer.effects.noSdi'));
      break;
    case 'CasaZenDirectOnly': {
      lines.push(t('fiscalDocuments.issuer.effects.casazen.direct'));
      lines.push(t('fiscalDocuments.issuer.effects.casazen.portals'));
      const rule = settings.regime === regime ? settings.rule : undefined;
      const invoice = hasElectronicInvoice(regime, rule);
      if (invoice === true) {
        lines.push(
          settings.sdi.providerConfigured ? t('fiscalDocuments.issuer.effects.sdi.available') : t('fiscalDocuments.issuer.effects.sdi.notAvailable'),
        );
      } else if (invoice === false) {
        lines.push(t('fiscalDocuments.issuer.effects.casazen.receipt'));
      }
      if (!rule?.configured) lines.push(t('fiscalDocuments.issuer.effects.casazen.ruleUnconfirmed'));
      break;
    }
    case 'Accountant':
      lines.push(t('fiscalDocuments.issuer.effects.accountant.issues'));
      lines.push(t('fiscalDocuments.issuer.effects.noSdi'));
      break;
  }

  lines.push(t('fiscalDocuments.issuer.effects.change'));
  return lines;
}
