import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { leaseOperationsApi } from '@/api/lease-operations.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getProblemMessage } from '@/lib/api-errors';
import { isStayDate, parseStayDate, startOfMonth } from '@/lib/stay-dates';
import { formatCurrency } from '@/lib/utils';
import { useIstatCalculation } from '@/queries/use-lease-operations';
import type { LeaseDetail, LeaseOperations } from '@/types';
import { Disclosure } from '../guide/disclosure';
import { longDay } from '../lifecycle/lifecycle-format';
import { addMonths } from '../wizard/wizard-model';
import { LetterSentForm } from './letter-sent-form';
import { formatPercent, letterState, parsePercent } from './operations-model';
import { useLetterDownload } from './use-letter-download';

/** How long the percentages stand still before the server is asked to work them out. */
const CALCULATION_DELAY_MS = 400;

interface IstatDialogProps {
  open: boolean;
  lease: LeaseDetail;
  operations: LeaseOperations;
  onClose: () => void;
}

/** The first of the next month when it is inside the days the update can start from (the first installment after the request), else the first day it can. */
function defaultEffectiveDay(min: string, max: string): string {
  const nextMonth = addMonths(startOfMonth(min), 1);
  return nextMonth !== '' && (max === '' || nextMonth <= max) ? nextMonth : min;
}

function IstatBody({ lease, operations, onClose }: Omit<IstatDialogProps, 'open'>) {
  const { t, i18n } = useTranslation();
  const istat = operations.istat;
  const letter = letterState(operations, 'AggiornamentoIstat');
  const { busy, download } = useLetterDownload();

  const min = parseStayDate(istat.minEffectiveOn);
  const max = parseStayDate(istat.maxEffectiveOn);
  const [foiText, setFoiText] = useState('');
  const [shareText, setShareText] = useState(String(istat.defaultSharePercent));
  const [effectiveFrom, setEffectiveFrom] = useState(() => defaultEffectiveDay(min, max));

  const foi = parsePercent(foiText);
  const share = parsePercent(shareText);
  const shareValid = share !== null && share <= istat.maxSharePercent;
  const input = useMemo(() => (foi !== null && share !== null && shareValid ? { foiPercent: foi, sharePercent: share } : null), [foi, share, shareValid]);
  const settled = useDebouncedValue(input, CALCULATION_DELAY_MS);
  const calculation = useIstatCalculation(lease.id, settled);

  // The figure on screen is the one of the percentages on screen: while the next answer arrives nothing stale is shown.
  const result =
    calculation.data && foi !== null && share !== null && calculation.data.foiPercent === foi && calculation.data.sharePercent === share
      ? calculation.data
      : undefined;
  const refusal = input !== null && !result && calculation.error ? getProblemMessage(calculation.error, t) : undefined;

  const dateValid = isStayDate(effectiveFrom) && (min === '' || effectiveFrom >= min) && (max === '' || effectiveFrom <= max);
  const canDownload = result !== undefined && dateValid;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('leaseOperations.istat.dialog.title')}</DialogTitle>
        <DialogDescription>{t('leaseOperations.istat.dialog.description')}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={t('leaseOperations.istat.dialog.foiLabel')}
          hint={t('leaseOperations.istat.dialog.foiHint')}
          error={foiText.trim() !== '' && foi === null ? t('leaseOperations.istat.dialog.foiInvalid') : undefined}
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={foiText}
            onChange={(event) => setFoiText(event.target.value)}
            className="pointer-coarse:h-11"
            data-testid="istat-foi"
          />
        </Field>
        <Field
          label={t('leaseOperations.istat.dialog.shareLabel')}
          hint={t('leaseOperations.istat.dialog.shareHint')}
          error={shareText.trim() !== '' && !shareValid ? t('leaseOperations.istat.dialog.shareInvalid', { max: istat.maxSharePercent }) : undefined}
        >
          <Input
            inputMode="decimal"
            autoComplete="off"
            value={shareText}
            onChange={(event) => setShareText(event.target.value)}
            className="pointer-coarse:h-11"
            data-testid="istat-share"
          />
        </Field>
      </div>

      <Field
        label={t('leaseOperations.istat.dialog.effectiveLabel')}
        hint={t('leaseOperations.istat.dialog.effectiveHint')}
        error={
          effectiveFrom !== '' && !dateValid
            ? t('leaseOperations.istat.dialog.effectiveInvalid', { from: longDay(min, i18n.language), to: longDay(max, i18n.language) })
            : undefined
        }
      >
        <Input
          type="date"
          value={effectiveFrom}
          min={min || undefined}
          max={max || undefined}
          onChange={(event) => setEffectiveFrom(event.target.value)}
          className="pointer-coarse:h-11"
          data-testid="istat-effective"
        />
      </Field>

      <p className="min-w-0 break-words text-sm font-medium" role="status" data-testid="istat-result">
        {result
          ? t('leaseOperations.istat.dialog.result', {
              from: formatCurrency(result.currentRent),
              to: formatCurrency(result.newRent),
              increase: formatCurrency(result.increase),
              percent: formatPercent(result.appliedPercent, i18n.language),
              share: formatPercent(result.sharePercent, i18n.language),
            })
          : (refusal ?? t('leaseOperations.istat.dialog.resultPending'))}
      </p>

      <p className="text-sm text-foreground/70">{t('leaseOperations.istat.dialog.note')}</p>

      {letter && !letter.approved ? (
        <p className="text-sm text-foreground/70" data-testid="istat-draft-note">
          {t('leaseOperations.draftNote')}
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          {t('shared.close')}
        </Button>
        <Button
          type="button"
          loading={busy}
          disabled={!canDownload}
          onClick={() => {
            if (!result) return;
            void download(
              () =>
                leaseOperationsApi.downloadAggiornamentoIstat(lease.id, {
                  foiPercent: result.foiPercent,
                  sharePercent: result.sharePercent,
                  effectiveFrom,
                }),
              `aggiornamento-istat-${lease.id}.pdf`,
            );
          }}
          data-testid="istat-download"
        >
          {t('leaseOperations.download.label')}
        </Button>
      </DialogFooter>

      <Disclosure summary={t('leaseOperations.sent.title')} testId="istat-after">
        <LetterSentForm leaseId={lease.id} startDate={lease.startDate} kind="AggiornamentoIstat" sent={letter?.sent ?? null} />
      </Disclosure>
    </div>
  );
}

/**
 * «Calcola l'aggiornamento ISTAT» (LR-OPS-1c): the window of the landlord's request to update the rent. The landlord types the variation of the
 * FOI index (CasaZen never calls an external service for it) and the share of it the contract recognizes (the server suggests one and bounds it),
 * and from which day the new rent applies (never in the past); the server works out the new rent to the cent and writes the draft of the request
 * with the same numbers. It is never offered under the cedolare secca, which suspends every update. The window does not change the rent of the
 * lease or the plan of the rents: it prepares the letter. Controlled by the address (`?operazione=istat`); its content is forgotten when it closes.
 */
export function IstatDialog({ open, lease, operations, onClose }: IstatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-h-[90dvh] sm:overflow-y-auto" data-testid="istat-dialog">
        <IstatBody lease={lease} operations={operations} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
