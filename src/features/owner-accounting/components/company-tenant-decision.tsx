import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PlainSection } from '@/components/shared/calm';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useCompanyTenantCases, useDecideCompanyTenant, usePendingCompanyTenantCases } from '@/queries/use-owner-tax-checks';
import type { CompanyTenantCase, ShortLetTaxRegime } from '@/types';
import { failureText, messageOf } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';

const REASON_MAX = 500;

const DECISION_PARAM = 'decision';

const REGIMES: readonly ShortLetTaxRegime[] = ['ShortLet', 'NotShortLet'];

interface DecisionFormProps {
  kase: CompanyTenantCase;
  onClose: () => void;
}

/**
 * The decision about one stay of a company tenant (⚖ I7): the two readings of the rule in plain words, the regime to apply with no default (the person chooses), and the note of why. CasaZen never changes the regime by
 * itself: a stay nobody decided about stays a short let, and what is chosen here is recorded, with who decided it and when, and followed by the withholding of the next payout. A decision can be replaced by a later one; the
 * first stays in the history. Nothing of the tenant is shown here or asked: the stay is told by the code of its booking, its property and its days.
 */
function DecisionForm({ kase, onClose }: DecisionFormProps) {
  const { t, i18n } = useTranslation();
  const { date, dateTime } = useOwnerFormat();
  const decide = useDecideCompanyTenant();
  const [regime, setRegime] = useState<ShortLetTaxRegime | null>(null);
  const [reason, setReason] = useState('');
  const [failure, setFailure] = useState<string | null>(null);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second submit in between is stopped here.
  const sending = useRef(false);
  const note = reason.trim();
  const ready = regime !== null && note.length > 0;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (regime === null || note.length === 0 || decide.isPending || sending.current) return;
    sending.current = true;
    setFailure(null);
    try {
      await decide.mutateAsync({ bookingId: kase.bookingId, regime, reason: note });
      toast.success(t('ownerAccounting.tenantDecision.done'));
      onClose();
    } catch (error) {
      setFailure(failureText(error, t, i18n.exists));
    } finally {
      sending.current = false;
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="grid gap-4" data-testid="tenant-decision-form">
      <div className="space-y-1 text-sm" data-testid="tenant-decision-case">
        <p className="break-words font-medium">
          {t('ownerAccounting.tenantDecision.stay', { code: kase.bookingCode, property: kase.propertyName })}
        </p>
        <p className="break-words text-foreground/70">{t('ownerAccounting.tenantDecision.days', { checkIn: date(kase.checkIn), checkOut: date(kase.checkOut) })}</p>
        {kase.decision !== null && kase.decidedAt ? (
          <p className="break-words" data-testid="tenant-decision-current">
            {t('ownerAccounting.tenantDecision.current', { regime: t(`ownerAccounting.tenantDecision.regime.${kase.decision}.title`), date: dateTime(kase.decidedAt) })}
          </p>
        ) : null}
      </div>

      <div className="space-y-1 text-sm text-foreground/80" data-testid="tenant-decision-readings">
        <p className="break-words">{t('ownerAccounting.tenantDecision.readings.agency')}</p>
        <p className="break-words">{t('ownerAccounting.tenantDecision.readings.cassation')}</p>
        <p className="break-words font-medium text-foreground">{t('ownerAccounting.tenantDecision.readings.advice')}</p>
      </div>

      <ChoiceGroup legend={t('ownerAccounting.tenantDecision.legend')} minCardWidth={14}>
        {REGIMES.map((value) => (
          <ChoiceCard
            key={value}
            name="tenant-decision-regime"
            value={value}
            checked={regime === value}
            disabled={decide.isPending}
            onChange={() => setRegime(value)}
            title={t(`ownerAccounting.tenantDecision.regime.${value}.title`)}
            description={t(`ownerAccounting.tenantDecision.regime.${value}.description`)}
            data-testid={`tenant-decision-regime-${value}`}
          />
        ))}
      </ChoiceGroup>

      <Field label={t('ownerAccounting.tenantDecision.reason')} hint={t('ownerAccounting.tenantDecision.reasonHint')} counter={`${reason.length}/${REASON_MAX}`}>
        <Textarea value={reason} maxLength={REASON_MAX} rows={3} readOnly={decide.isPending} onChange={(event) => setReason(event.target.value)} data-testid="tenant-decision-reason" />
      </Field>

      {failure ? (
        <Alert variant="danger" data-testid="tenant-decision-error">
          {failure}
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={decide.isPending}>
          {t('shared.cancel')}
        </Button>
        <Button type="submit" loading={decide.isPending} disabled={!ready} data-testid="tenant-decision-confirm">
          {t('ownerAccounting.tenantDecision.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface TenantDecisionDialogProps {
  bookingId: string;
  onClose: () => void;
}

export function CompanyTenantDecisionDialog({ bookingId, onClose }: TenantDecisionDialogProps) {
  const { t } = useTranslation();
  const cases = useCompanyTenantCases(true);
  const list = cases.isError ? undefined : cases.data;
  const inList = list?.find((candidate) => candidate.bookingId === bookingId) ?? null;
  const older = usePendingCompanyTenantCases(Array.isArray(list) && inList === null);
  const kase = inList ?? (older.isError ? undefined : older.data)?.find((candidate) => candidate.bookingId === bookingId) ?? null;
  const retry = older.isError && inList === null ? older : cases;

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('ownerAccounting.tenantDecision.title')}</DialogTitle>
          <DialogDescription>{t('ownerAccounting.tenantDecision.description')}</DialogDescription>
        </DialogHeader>
        {cases.isPending || older.isLoading ? (
          <SkeletonCard lines={3} label={t('ownerAccounting.tenantDecision.loading')} />
        ) : cases.isError || (older.isError && kase === null) ? (
          <Alert
            variant="danger"
            action={
              <Button type="button" size="sm" variant="outline" onClick={() => void retry.refetch()}>
                {t('shared.errorState.retry')}
              </Button>
            }
            data-testid="tenant-decision-load-error"
          >
            {messageOf(retry.error, t)}
          </Alert>
        ) : list === null || list === undefined ? (
          <Alert variant="warning" data-testid="tenant-decision-no-access">
            {t('ownerAccounting.tenantDecision.noAccess')}
          </Alert>
        ) : kase === null ? (
          <div className="space-y-4" data-testid="tenant-decision-gone">
            <Alert variant="info">{t('ownerAccounting.tenantDecision.gone')}</Alert>
            <DialogFooter>
              <Button type="button" onClick={onClose}>
                {t('shared.close')}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <DecisionForm kase={kase} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The stays of a company tenant in the property of a private owner (E18/F01/US03/T01, ⚖ I7), the ones that wait for a decision first and the ones decided after them, each with the way to decide or to decide again. It
 * is behind the flag `taxReportingExports` (the backend answers 404 without it) and draws nothing when there is none: a calm page has this section only when it has something to ask. The decision of one stay
 * is open while the address says so (`?decision=<booking>`): the «Da fare» of the stay leads here with it, a button of the list sets it, and closing the dialog takes it off. The address is the only place that
 * says which stay is being decided: nothing of it is kept in the storage of the browser, and the id of a booking is not personal data.
 */
export function CompanyTenantCasesSection() {
  const { t } = useTranslation();
  const { date } = useOwnerFormat();
  const { flags } = useFeatureFlags();
  const enabled = isFeatureEnabled(flags, 'taxReportingExports');
  const cases = useCompanyTenantCases(enabled);
  const [params, setParams] = useSearchParams();
  const open = enabled ? params.get(DECISION_PARAM) : null;

  const decide = (bookingId: string | null) => {
    const next = new URLSearchParams(params);
    if (bookingId) next.set(DECISION_PARAM, bookingId);
    else next.delete(DECISION_PARAM);
    setParams(next, { replace: bookingId === null });
  };
  const close = () => decide(null);

  if (!enabled) return null;
  const list = cases.isError ? undefined : cases.data;
  const dialog = open ? <CompanyTenantDecisionDialog bookingId={open} onClose={close} /> : null;

  let content: ReactNode = null;
  if (cases.isError) {
    content = (
      <PlainSection title={t('ownerAccounting.tenantDecision.sectionTitle')} data-testid="tenant-cases">
        <Alert
          variant="danger"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void cases.refetch()}>
              {t('shared.errorState.retry')}
            </Button>
          }
          data-testid="tenant-cases-error"
        >
          {messageOf(cases.error, t)}
        </Alert>
      </PlainSection>
    );
  } else if (list === null) {
    content = (
      <PlainSection title={t('ownerAccounting.tenantDecision.sectionTitle')} data-testid="tenant-cases">
        <p className="break-words text-sm text-foreground/70" data-testid="tenant-cases-no-access">
          {t('ownerAccounting.tenantDecision.noAccess')}
        </p>
      </PlainSection>
    );
  } else if (list !== undefined && list.length > 0) {
    const pending = list.filter((candidate) => candidate.decision === null);
    const ordered = [...pending, ...list.filter((candidate) => candidate.decision !== null)];
    content = (
      <PlainSection title={t('ownerAccounting.tenantDecision.sectionTitle')} count={pending.length} data-testid="tenant-cases">
        <p className="break-words text-sm text-foreground/70">{t('ownerAccounting.tenantDecision.sectionHint')}</p>
        <ul role="list" className="divide-y divide-border">
          {ordered.map((candidate) => (
            <li key={candidate.bookingId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between" data-testid="tenant-case" data-decision={candidate.decision ?? 'Pending'}>
              <div className="min-w-0 space-y-0.5">
                <p className="break-words font-medium">{t('ownerAccounting.tenantDecision.stay', { code: candidate.bookingCode, property: candidate.propertyName })}</p>
                <div className="flex flex-wrap items-center gap-2 text-sm text-foreground/70">
                  <span>{t('ownerAccounting.tenantDecision.days', { checkIn: date(candidate.checkIn), checkOut: date(candidate.checkOut) })}</span>
                  <Badge variant={candidate.decision === null ? 'warning' : 'secondary'}>
                    {candidate.decision === null ? t('ownerAccounting.tenantDecision.pending') : t(`ownerAccounting.tenantDecision.regime.${candidate.decision}.title`)}
                  </Badge>
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => decide(candidate.bookingId)} data-testid={`tenant-case-decide-${candidate.bookingId}`}>
                {candidate.decision === null ? t('ownerAccounting.tenantDecision.decide') : t('ownerAccounting.tenantDecision.change')}
              </Button>
            </li>
          ))}
        </ul>
      </PlainSection>
    );
  }

  return (
    <>
      {content}
      {dialog}
    </>
  );
}
