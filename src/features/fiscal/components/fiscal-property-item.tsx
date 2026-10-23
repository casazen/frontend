import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StatusBadge } from '@/components/shared/status/status-badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { ROW_BUTTON } from '@/features/compliance/components/compliance-row';
import { NoteLine } from '@/features/dashboard/components/note-line';
import type { NoteTone } from '@/features/dashboard/lib/home-model';
import { fiscalRegimeStatus, fiscalRegimeSelectId } from '@/features/fiscal/fiscal-focus';
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

/** Over the threshold and a regime still to choose ask for attention; the other notes only inform. */
const TAX_NOTE_TONES: Record<FiscalTaxNote, NoteTone> = {
  irpef_ordinaria_not_computed: 'info',
  short_stay_threshold_exceeded: 'warning',
  regime_not_assigned: 'warning',
  impresa_not_computed: 'info',
};

interface FiscalPropertyItemProps {
  row: FiscalPropertyRow;
  snapshot: FiscalRegimeSnapshot;
  /** A regime is being saved: the controls wait. */
  pending: boolean;
  /** Whoever may change the properties gets the controls; the others see the state of each one. */
  canWrite: boolean;
  onAssign: (regime: StrFiscalRegime) => void;
}

/**
 * A property and its regime for the tax year: the name, the regime it has and its state, what the backend says about it, and,
 * for whoever may change it, the one control that chooses the regime and the buttons that confirm the recommended one or
 * designate the unit at 21%. On a phone everything is one column with the controls under the text.
 */
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
  const canDesignate = available.has('CedolareSecca21') && row.assignedRegime !== 'CedolareSecca21';
  const movesReducedRate =
    canDesignate && taxpayer?.reducedRatePropertyId != null && taxpayer.reducedRatePropertyId !== row.propertyId;
  const showRecommended = row.recommendedRegime != null && row.recommendedRegime !== row.assignedRegime;
  // With one taxpayer, the organization's, the line says nothing; it matters when there are several or a person's own.
  const showTaxpayer = taxpayer != null && (taxpayers.length > 1 || !taxpayer.isOrgTaxProfile);
  const selectId = fiscalRegimeSelectId(row.propertyId);
  const confirmLabel = t('fiscal.confirmRecommended');
  const primaryLabel = t('fiscal.primary');
  const taxNoteKey = row.taxNote ? TAX_NOTE_KEYS[row.taxNote] : undefined;

  return (
    <li
      data-testid={`fiscal-property-card-${row.propertyId}`}
      // One column on a phone, with the controls under the text; text and controls side by side from `md` when there are controls.
      className={cn(
        'grid min-w-0 grid-cols-[minmax(0,1fr)] gap-x-8 gap-y-3 py-4',
        canWrite && 'md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start',
      )}
    >
      <div className="min-w-0 space-y-1.5">
        <p className="break-words font-semibold">{row.name}</p>
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
          {status !== 'Confirmed' && row.recommendedRegime && available.has(row.recommendedRegime) ? (
            <Button
              variant="outline"
              size="sm"
              className={ROW_BUTTON}
              data-testid={`fiscal-confirm-${row.propertyId}`}
              aria-label={t('dashboard.row.actionFor', { action: confirmLabel, name: row.name })}
              disabled={pending}
              onClick={() => onAssign(row.recommendedRegime!)}
            >
              {confirmLabel}
            </Button>
          ) : null}
          {canDesignate ? (
            <div className="space-y-2">
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
              {movesReducedRate ? (
                <p data-testid={`fiscal-primary-moves-${row.propertyId}`}>
                  <NoteLine note={{ text: t('fiscal.primaryMoves'), tone: 'warning' }} />
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
