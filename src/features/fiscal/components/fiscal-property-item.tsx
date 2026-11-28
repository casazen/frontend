import { Building2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import { NoteLine } from '@/features/dashboard/components/note-line';
import type { NoteTone } from '@/features/dashboard/lib/home-model';
import { fiscalRegimeStatus } from '@/features/fiscal/fiscal-focus';
import { TAX_NOTE_KEYS } from '@/features/fiscal/fiscal-format';
import { cn } from '@/lib/utils';
import {
  STR_FISCAL_REGIMES,
  type FiscalPropertyRow,
  type FiscalRegimeSnapshot,
  type FiscalTaxNote,
  type StrFiscalRegime,
} from '@/api/fiscal.api';

const IMPRESA_REGIMES: readonly StrFiscalRegime[] = ['RegimeOrdinario', 'RegimeForfettario'];

const TAX_NOTE_TONES: Record<FiscalTaxNote, NoteTone> = {
  irpef_ordinaria_not_computed: 'info',
  short_stay_threshold_exceeded: 'warning',
  regime_not_assigned: 'warning',
  impresa_not_computed: 'info',
};

interface FiscalPropertyItemProps {
  row: FiscalPropertyRow;
  snapshot: FiscalRegimeSnapshot;
  pending: boolean;
  canWrite: boolean;
  onAssign: (regime: StrFiscalRegime) => void;
}

export function FiscalPropertyItem({ row, snapshot, pending, canWrite, onAssign }: FiscalPropertyItemProps) {
  const { t } = useTranslation();
  const available = new Set(row.availableRegimes ?? []);
  const taxpayers = snapshot.taxpayers ?? [];
  const taxpayer = taxpayers.find((tp) => tp.index === row.taxpayerIndex);
  const status = fiscalRegimeStatus(row);
  const regimeLabel = (regime: StrFiscalRegime | null) => (regime ? t(`fiscal.regime.${regime}`) : t('fiscal.notAssigned'));
  const unavailableReason = (regime: StrFiscalRegime) =>
    IMPRESA_REGIMES.includes(regime) ? t('fiscal.unavailable.partitaIva') : t('fiscal.unavailable.threshold');
  const impresaBlocked = IMPRESA_REGIMES.every((r) => !available.has(r));
  const confirmableRegime = status !== 'Confirmed' && row.recommendedRegime && available.has(row.recommendedRegime) ? row.recommendedRegime : null;
  const canDesignate = available.has('CedolareSecca21') && row.assignedRegime !== 'CedolareSecca21';
  const movesReducedRate =
    canDesignate && taxpayer?.reducedRatePropertyId != null && taxpayer.reducedRatePropertyId !== row.propertyId;
  const showRecommended = row.recommendedRegime != null && row.recommendedRegime !== row.assignedRegime;
  const showTaxpayer = taxpayer != null && (taxpayers.length > 1 || !taxpayer.isOrgTaxProfile);
  const selectId = `fiscal-regime-${row.propertyId}`;
  const confirmLabel = t('fiscal.confirmRecommended');
  const primaryLabel = t('fiscal.primary');
  const taxNoteKey = row.taxNote ? TAX_NOTE_KEYS[row.taxNote] : undefined;

  return (
    <li
      data-testid={`fiscal-property-card-${row.propertyId}`}
      className={cn(
        'grid min-w-0 grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-4 rounded-xl border bg-card p-4',
        canWrite && 'md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start',
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <p className="flex items-center gap-2 text-base font-semibold">
          <Building2 aria-hidden="true" className="size-5 shrink-0 text-primary-text" />
          <span className="min-w-0 break-words">{row.name}</span>
        </p>
        <p data-testid={`fiscal-assigned-${row.propertyId}`} className="break-words text-sm text-foreground/70">
          {t('fiscal.assigned')}: <span className="font-medium text-foreground">{regimeLabel(row.assignedRegime)}</span>
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <StatusBadge kind="fiscalRegime" status={status} />
        </div>
        {showRecommended ? (
          <p className="break-words text-sm text-foreground/70">
            {t('fiscal.recommended')}: {regimeLabel(row.recommendedRegime)}
          </p>
        ) : null}
        {showTaxpayer ? (
          <p className="break-words text-sm text-foreground/70" data-testid={`fiscal-taxpayer-${row.propertyId}`}>
            {taxpayer.isOrgTaxProfile ? t('fiscal.taxpayer.org') : t('fiscal.taxpayer.code', { code: taxpayer.fiscalCodeMasked ?? '' })}
          </p>
        ) : null}
        {status === 'ToConfirm' ? (
          <p data-testid={`fiscal-unconfirmed-${row.propertyId}`}>
            <NoteLine note={{ text: t('fiscal.unconfirmed'), tone: 'info' }} />
          </p>
        ) : null}
        {row.taxNote && taxNoteKey ? (
          <p data-testid={`fiscal-tax-note-${row.propertyId}`}>
            <NoteLine note={{ text: t(taxNoteKey), tone: TAX_NOTE_TONES[row.taxNote] }} />
          </p>
        ) : null}
        {impresaBlocked && taxpayer?.isOrgTaxProfile ? (
          <div data-testid={`fiscal-piva-required-${row.propertyId}`}>
            <NoteLine note={{ text: t('fiscal.unavailable.partitaIvaHint'), tone: 'info' }} />
            {canWrite ? (
              <Button asChild variant="link" className="h-auto min-h-11 px-0">
                <Link to="/app/short-rent/fiscal/wizard">{t('fiscal.wizard.link')}</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {canWrite ? (
        <div className="min-w-0 space-y-3">
          <Field label={t('fiscal.chooseRegime')} id={selectId}>
            <Select
              data-testid={`fiscal-regime-select-${row.propertyId}`}
              value={row.assignedRegime ?? ''}
              disabled={pending || available.size === 0}
              onChange={(e) => {
                const regime = e.target.value as StrFiscalRegime;
                if (regime && regime !== row.assignedRegime) onAssign(regime);
              }}
            >
              <option value="" disabled>
                {t('fiscal.selectPlaceholder')}
              </option>
              {STR_FISCAL_REGIMES.map((regime) => (
                <option key={regime} value={regime} disabled={!available.has(regime)}>
                  {available.has(regime)
                    ? t(`fiscal.regime.${regime}`)
                    : t('fiscal.unavailable.option', { regime: t(`fiscal.regime.${regime}`), reason: unavailableReason(regime) })}
                </option>
              ))}
            </Select>
          </Field>
          {confirmableRegime ? (
            <Button
              variant="outline"
              size="sm"
              className={ROW_BUTTON}
              data-testid={`fiscal-confirm-${row.propertyId}`}
              aria-label={t('dashboard.row.actionFor', { action: confirmLabel, name: row.name })}
              disabled={pending}
              onClick={() => onAssign(confirmableRegime)}
            >
              {confirmLabel}
            </Button>
          ) : null}
          {canDesignate && confirmableRegime !== 'CedolareSecca21' ? (
            <Button
              variant="outline"
              size="sm"
              className={ROW_BUTTON}
              data-testid={`fiscal-primary-${row.propertyId}`}
              aria-label={t('dashboard.row.actionFor', { action: primaryLabel, name: row.name })}
              disabled={pending}
              onClick={() => onAssign('CedolareSecca21')}
            >
              {primaryLabel}
            </Button>
          ) : null}
          {movesReducedRate ? (
            <p data-testid={`fiscal-primary-moves-${row.propertyId}`}>
              <NoteLine note={{ text: t('fiscal.primaryMoves'), tone: 'warning' }} />
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
