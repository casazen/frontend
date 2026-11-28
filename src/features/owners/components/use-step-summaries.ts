import { useTranslation } from 'react-i18next';
import { OWNER_ISSUER_REGIMES } from '@/types';
import type { OwnerAccountingPolicy, OwnerFiscalProfile, OwnerIssuerProfile, OwnerMandate } from '@/types';
import { mandateCovers, maskValue } from '@/features/owner-accounting/owner-accounting-model';
import { useOwnerFormat } from '@/features/owner-accounting/use-owner-format';
import type { PathStep } from './owner-profile-overview';

interface StepInputs {
  profile: OwnerFiscalProfile | null;
  policy: OwnerAccountingPolicy | null;
  mandates: readonly OwnerMandate[] | undefined;
  issuer: OwnerIssuerProfile | null | undefined;
  today: string;
}

type Summary = Pick<PathStep, 'value' | 'detail'>;

export function useStepSummaries() {
  const { t } = useTranslation();
  const { date, percent } = useOwnerFormat();
  const masked = (profile: OwnerFiscalProfile, value: string | null) => (profile.masked ? value : maskValue(value));

  return {
    identity({ profile }: StepInputs): Summary {
      if (!profile) return { value: t('ownerProfile.path.notFilled'), detail: null };
      const code = [
        profile.fiscalCode ? t('ownerProfile.summary.fiscalCode', { code: masked(profile, profile.fiscalCode) }) : null,
        !profile.fiscalCode && profile.vatNumber ? t('ownerProfile.summary.vat', { code: masked(profile, profile.vatNumber) }) : null,
        !profile.fiscalCode && !profile.vatNumber && profile.foreignTaxId ? t('ownerProfile.summary.foreignTaxId', { code: masked(profile, profile.foreignTaxId) }) : null,
      ].find(Boolean);
      const residence = profile.taxResidenceCountry ? t('ownerProfile.summary.residence', { country: profile.taxResidenceCountry }) : null;
      return { value: t(`ownerProfile.options.entityKind.${profile.entityKind}`), detail: [residence, code].filter(Boolean).join(' · ') || null };
    },
    payments({ profile }: StepInputs): Summary {
      if (!profile) return { value: t('ownerProfile.path.notFilled'), detail: null };
      return {
        value: profile.settlementCurrency ? t('ownerProfile.summary.currency', { currency: profile.settlementCurrency }) : t('ownerProfile.path.currencyMissing'),
        detail: profile.bankAccountReference ? t('ownerProfile.summary.iban', { iban: masked(profile, profile.bankAccountReference) }) : t('ownerProfile.path.ibanMissing'),
      };
    },
    mandate({ mandates, today }: StepInputs): Summary {
      if (!mandates) return { value: t('ownerMandate.loading'), detail: null };
      const current = mandates.find((mandate) => mandateCovers(mandate, today)) ?? null;
      if (!current) return { value: t('owners.row.mandateMissing'), detail: null };
      return {
        value: `${percent(current.commissionPercent)} ${current.commissionIncludesVat ? t('ownerMandate.vat.included') : t('ownerMandate.vat.excluded')}`,
        detail: t('ownerMandate.version.from', { from: date(current.validFrom) }),
      };
    },
    documents({ issuer }: StepInputs): Summary {
      if (!issuer || !issuer.exists) return { value: t('ownerProfile.path.documents.none'), detail: null };
      const regime = (OWNER_ISSUER_REGIMES as readonly string[]).includes(issuer.regime ?? '') ? t(`ownerIssuer.regime.${issuer.regime}.title`) : (issuer.regime ?? t('ownerProfile.path.documents.none'));
      return { value: regime, detail: issuer.canIssue ? t('ownerProfile.path.documents.ready') : t('ownerProfile.path.documents.incomplete') };
    },
    rule({ policy }: StepInputs): Summary {
      if (!policy) return { value: t('ownerProfile.policy.none'), detail: null };
      return {
        value: t('ownerProfile.path.rule.value', { rule: policy.ruleCode, version: policy.version }),
        detail: policy.approved ? t('ownerProfile.path.rule.approvedBy', { name: policy.approvedByName ?? '' }) : t('ownerProfile.policy.waiting'),
      };
    },
  };
}
