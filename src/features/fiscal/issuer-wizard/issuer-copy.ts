import type { TFunction } from 'i18next';
import type { DocumentIssuerMode, DocumentRegime, FiscalDocumentSettings } from '@/types';

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
 * What the choice means in plain words, one sentence for each thing CasaZen will and will not do (NF-05). Only what is true today:
 *
 * - a booking has one issuer: where the channel manager issues CasaZen never does, and CasaZen never issues for a booking that comes from a
 *   portal, in any mode (the server refuses it);
 * - the electronic invoice is not sent to the SDI by CasaZen while the server has no channel for it (`sdi.providerConfigured`): the file is
 *   downloaded;
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
      lines.push(
        settings.sdi.providerConfigured ? t('fiscalDocuments.issuer.effects.sdi.available') : t('fiscalDocuments.issuer.effects.sdi.notAvailable'),
      );
      const rule = settings.regime === regime ? settings.rule : undefined;
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
