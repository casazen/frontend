import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRliAdvisory } from '@/queries/use-leases';
import { formatCurrency } from '@/lib/utils';
import { getProblemMessage } from '@/lib/api-errors';
import type { CedolareAdvisory, CedolareAdvisoryInput } from '@/types';

interface Props {
  leaseId: string;
}

/** Note codes this frontend can explain; an unknown code is skipped rather than shown raw. */
const NOTE_CODES = [
  'ata_unverified',
  'ata_not_listed',
  'emergency_comuni_not_checked',
  'concordato_attestation_required',
  'transitorio_reliefs_to_confirm',
  'short_term_annualized',
  'tax_regime_unknown',
  'questura_not_replaced',
];

const IRPEF_REASONS = [
  'not_configured',
  'brackets_outdated',
  'income_over_limit',
  'concordato_ata_relief_not_verified',
];

/** Same bounds as the backend request (`CedolareAdvisoryRequest`). */
const LIMITS = {
  writtenPages: [1, 1_000],
  lines: [1, 100_000],
  copies: [1, 20],
  otherTaxableIncomeEur: [0, 100_000_000],
} as const;

const percentFormat = new Intl.NumberFormat('it-IT', { style: 'percent', maximumFractionDigits: 2 });

function formatPercent(value: number): string {
  return percentFormat.format(value);
}

/** Italian thousands separators ("20.000", "1.250,50"): the dots go, the decimal comma becomes a dot. */
const ITALIAN_THOUSANDS = /^\d{1,3}(\.\d{3})+(,\d+)?$/;

/** Parses an optional field: `undefined` when empty, `null` when invalid. */
function parseField(value: string, [min, max]: readonly [number, number], integer: boolean): number | undefined | null {
  const trimmed = value.trim().replace(/\s/g, '');
  if (!trimmed) return undefined;
  const normalized = ITALIAN_THOUSANDS.test(trimmed) ? trimmed.replace(/\./g, '') : trimmed;
  if (!/^\d+([.,]\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  if (integer && !Number.isInteger(parsed)) return null;
  return parsed;
}

/**
 * Tax advisory of the lease (LT-08): cedolare secca against the ordinary regime. The backend computes every figure from
 * configured parameters; the stamp duty and the IRPEF comparison need data CasaZen does not hold, entered here and sent
 * only for the computation (POST body, never stored).
 */
export function CedolareDecisionPanel({ leaseId }: Props) {
  const { t } = useTranslation();
  const [input, setInput] = useState<CedolareAdvisoryInput | undefined>(undefined);
  const { data, isLoading, isError, error, isFetching } = useRliAdvisory(leaseId, input);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.rli.advisory.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-950">
          {t('leases.rli.advisory.disclaimer')}
        </p>
        {isLoading && <p>{t('leases.rli.advisoryLoading')}</p>}
        {isError && (
          <p className="text-destructive" role="alert">
            {getProblemMessage(error, t) ?? t('leases.rli.advisoryError')}
          </p>
        )}
        {data && <AdvisoryBody data={data} />}
        {!isLoading && (
          <AdvisoryInputs pending={isFetching} onSubmit={setInput} />
        )}
      </CardContent>
    </Card>
  );
}

function AdvisoryBody({ data }: { data: CedolareAdvisory }) {
  const { t } = useTranslation();
  const { cedolare, ordinary } = data;
  const notes = data.notes.filter((code) => NOTE_CODES.includes(code));
  const sources = Array.from(
    new Set([cedolare.source, ordinary.registro.source, ordinary.bollo.source, ordinary.irpef.source].filter(Boolean)),
  ) as string[];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p>{t('leases.rli.advisory.annualRent', { amount: formatCurrency(data.annualRent) })}</p>
        {data.contractType === 'Concordato' && (
          <p data-testid="advisory-ata">
            {t('leases.rli.advisory.ataLabel')}: {t(`leases.rli.advisory.ata.${data.ata}`)}
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Option
          title={t('leases.rli.advisory.cedolare.title')}
          chosen={data.taxRegime === 'CedolareSecca'}
          testId="advisory-cedolare"
        >
          <Figure label={t('leases.rli.advisory.cedolare.rate')} value={formatPercent(cedolare.rate)}>
            {t(`leases.rli.advisory.cedolare.rateBasis.${cedolare.rateBasis}`)}
          </Figure>
          <Figure label={t('leases.rli.advisory.cedolare.tax')} value={formatCurrency(cedolare.annualTaxEur)} />
          <p className="text-muted-foreground">{t('leases.rli.advisory.cedolare.noRegistroBollo')}</p>
        </Option>

        <Option
          title={t('leases.rli.advisory.ordinary.title')}
          chosen={data.taxRegime === 'Ordinario'}
          testId="advisory-ordinary"
        >
          <Registro registro={ordinary.registro} />
          <Bollo bollo={ordinary.bollo} />
          <Irpef irpef={ordinary.irpef} />
        </Option>
      </div>

      {notes.length > 0 && (
        <div className="space-y-1">
          <p className="font-medium">{t('leases.rli.advisory.notesTitle')}</p>
          <ul className="list-disc space-y-1 pl-5" data-testid="advisory-notes">
            {notes.map((code) => (
              <li key={code}>{t(`leases.rli.advisory.note.${code}`)}</li>
            ))}
          </ul>
        </div>
      )}

      {sources.length > 0 && (
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="font-medium">{t('leases.rli.advisory.sources')}</p>
          <ul className="list-disc space-y-1 break-words pl-5">
            {sources.map((source) => (
              <li key={source}>{source}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Option({
  title,
  chosen,
  testId,
  children,
}: {
  title: string;
  chosen: boolean;
  testId: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 rounded-md border p-3" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        {chosen && <Badge variant="secondary">{t('leases.rli.advisory.chosen')}</Badge>}
      </div>
      {children}
    </section>
  );
}

function Figure({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-muted-foreground">{label}</p>
      {value && <p className="font-medium">{value}</p>}
      {children && <p className="text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

function Registro({ registro }: { registro: CedolareAdvisory['ordinary']['registro'] }) {
  const { t } = useTranslation();
  const formula = t(
    registro.baseShare < 1
      ? 'leases.rli.advisory.ordinary.registroFormulaReduced'
      : 'leases.rli.advisory.ordinary.registroFormulaFull',
    {
      rate: formatPercent(registro.rate),
      base: formatCurrency(registro.taxableBaseEur),
      share: formatPercent(registro.baseShare),
    },
  );

  return (
    <div className="space-y-1" data-testid="advisory-registro">
      <Figure label={t('leases.rli.advisory.ordinary.registro')} value={formatCurrency(registro.firstYearEur)}>
        {formula}
      </Figure>
      {registro.minimumApplied && (
        <p className="text-xs text-muted-foreground">
          {t('leases.rli.advisory.ordinary.registroMinimum', {
            minimum: formatCurrency(registro.firstYearMinimumEur),
            computed: formatCurrency(registro.computedEur),
          })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        {t('leases.rli.advisory.ordinary.registroNextYears', { rate: formatPercent(registro.rate) })}
      </p>
    </div>
  );
}

function Bollo({ bollo }: { bollo: CedolareAdvisory['ordinary']['bollo'] }) {
  const { t } = useTranslation();
  const rule = t('leases.rli.advisory.ordinary.bolloRule', {
    amount: formatCurrency(bollo.eurPerUnit),
    pages: bollo.pagesPerUnit,
    lines: bollo.linesPerUnit,
  });

  if (bollo.status !== 'Computed' || bollo.amountEur === null) {
    return (
      <div className="space-y-1" data-testid="advisory-bollo">
        <Figure label={t('leases.rli.advisory.ordinary.bollo')}>{rule}</Figure>
        <p className="text-xs">{t('leases.rli.advisory.ordinary.bolloInputRequired')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1" data-testid="advisory-bollo">
      <Figure label={t('leases.rli.advisory.ordinary.bollo')} value={formatCurrency(bollo.amountEur)}>
        {t('leases.rli.advisory.ordinary.bolloDetail', {
          units: bollo.units,
          amount: formatCurrency(bollo.eurPerUnit),
          copies: bollo.copies,
        })}
      </Figure>
      <p className="text-xs text-muted-foreground">{rule}</p>
      {!bollo.linesConsidered && (
        <p className="text-xs text-amber-800">
          {t('leases.rli.advisory.ordinary.bolloPagesOnly', {
            lines: bollo.linesPerUnit,
            pages: bollo.pagesPerUnit,
          })}
        </p>
      )}
    </div>
  );
}

function Irpef({ irpef }: { irpef: CedolareAdvisory['ordinary']['irpef'] }) {
  const { t } = useTranslation();

  if (irpef.status === 'Computed' && irpef.additionalGrossIrpefEur !== null) {
    return (
      <div className="space-y-1" data-testid="advisory-irpef">
        <Figure
          label={t('leases.rli.advisory.ordinary.irpefComputed', { year: irpef.taxYear })}
          value={formatCurrency(irpef.additionalGrossIrpefEur)}
        >
          {t('leases.rli.advisory.ordinary.irpefBase', {
            reduction: formatPercent(irpef.rentFlatReduction ?? 0),
            taxable: formatCurrency(irpef.taxableRentEur ?? 0),
          })}
        </Figure>
      </div>
    );
  }

  const reason = irpef.reasonCode && IRPEF_REASONS.includes(irpef.reasonCode)
    ? t(`leases.rli.advisory.ordinary.irpefReason.${irpef.reasonCode}`, { year: irpef.taxYear })
    : null;

  return (
    <div className="space-y-1" data-testid="advisory-irpef">
      <p className="text-muted-foreground">{t('leases.rli.advisory.ordinary.irpef')}</p>
      <p className="font-medium">{t('leases.rli.advisory.ordinary.irpefToAssess')}</p>
      {reason && <p className="text-xs text-muted-foreground">{reason}</p>}
      {irpef.status === 'InputRequired' && (
        <p className="text-xs">{t('leases.rli.advisory.ordinary.irpefInputHint')}</p>
      )}
    </div>
  );
}

function AdvisoryInputs({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (input: CedolareAdvisoryInput | undefined) => void;
}) {
  const { t } = useTranslation();
  const [writtenPages, setWrittenPages] = useState('');
  const [lines, setLines] = useState('');
  const [copies, setCopies] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [invalid, setInvalid] = useState(false);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = {
      writtenPages: parseField(writtenPages, LIMITS.writtenPages, true),
      lines: parseField(lines, LIMITS.lines, true),
      copies: parseField(copies, LIMITS.copies, true),
      otherTaxableIncomeEur: parseField(otherIncome, LIMITS.otherTaxableIncomeEur, false),
    };
    const anyInvalid = Object.values(parsed).some((value) => value === null);
    // Pages and copies go together: one without the other cannot give the stamp duty.
    const pagesWithoutCopies = (parsed.writtenPages === undefined) !== (parsed.copies === undefined);
    if (anyInvalid || pagesWithoutCopies) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    const input: CedolareAdvisoryInput = {
      writtenPages: parsed.writtenPages ?? undefined,
      lines: parsed.lines ?? undefined,
      copies: parsed.copies ?? undefined,
      otherTaxableIncomeEur: parsed.otherTaxableIncomeEur ?? undefined,
    };
    onSubmit(Object.values(input).some((value) => value !== undefined) ? input : undefined);
  };

  return (
    <form className="space-y-3 rounded-md border p-3" onSubmit={submit} noValidate>
      <div className="space-y-0.5">
        <p className="font-medium">{t('leases.rli.advisory.inputs.title')}</p>
        <p className="text-xs text-muted-foreground">{t('leases.rli.advisory.inputs.privacy')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="advisory-pages" label={t('leases.rli.advisory.inputs.writtenPages')}>
          <Input id="advisory-pages" inputMode="numeric" value={writtenPages} onChange={(e) => setWrittenPages(e.target.value)} />
        </Field>
        <Field id="advisory-lines" label={t('leases.rli.advisory.inputs.lines')}>
          <Input id="advisory-lines" inputMode="numeric" value={lines} onChange={(e) => setLines(e.target.value)} />
        </Field>
        <Field id="advisory-copies" label={t('leases.rli.advisory.inputs.copies')}>
          <Input id="advisory-copies" inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value)} />
        </Field>
        <Field id="advisory-income" label={t('leases.rli.advisory.inputs.otherIncome')}>
          <Input
            id="advisory-income"
            inputMode="decimal"
            autoComplete="off"
            value={otherIncome}
            onChange={(e) => setOtherIncome(e.target.value)}
          />
        </Field>
      </div>
      {invalid && (
        <p className="text-destructive" role="alert">
          {t('leases.rli.advisory.inputs.invalid')}
        </p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {pending ? t('leases.rli.advisory.inputs.updating') : t('leases.rli.advisory.inputs.submit')}
      </Button>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
