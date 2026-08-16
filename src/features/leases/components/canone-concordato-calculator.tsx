import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useCanoneConcordatoEligibility } from '@/queries/use-canone-concordato';
import { formatCurrency } from '@/lib/utils';
import type { CanoneConcordatoEligibility } from '@/api/canone-concordato.api';

interface Props {
  propertyId: string;
}

export function CanoneConcordatoCalculator({ propertyId }: Props) {
  const { t } = useTranslation();
  const eligibility = useCanoneConcordatoEligibility();
  const [sqm, setSqm] = useState('65');
  const [zone, setZone] = useState('');
  const [foglio, setFoglio] = useState('');
  const [typeACount, setTypeACount] = useState('2');
  const [typeBCount, setTypeBCount] = useState('3');
  const [typeCCount, setTypeCCount] = useState('0');
  const [typeDCount, setTypeDCount] = useState('0');
  const [furnished, setFurnished] = useState(false);
  const [years, setYears] = useState('3');
  const [result, setResult] = useState<CanoneConcordatoEligibility | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const data = await eligibility.mutateAsync({
      propertyId,
      query: {
        sqm: Number(sqm),
        typeACount: Number(typeACount),
        typeBCount: Number(typeBCount),
        typeCCount: Number(typeCCount),
        typeDCount: Number(typeDCount),
        furnished,
        years: Number(years),
        zone: zone.trim() || undefined,
        foglio: foglio.trim() || undefined,
      },
    });
    setResult(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.canoneConcordato.title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
          <Field label={t('leases.canoneConcordato.sqm')}>
            <Input type="number" min={1} value={sqm} onChange={(e) => setSqm(e.target.value)} required />
          </Field>
          <Field label={t('leases.canoneConcordato.zone')}>
            <Input value={zone} onChange={(e) => setZone(e.target.value)} placeholder={t('leases.canoneConcordato.zonePlaceholder')} />
          </Field>
          <Field label={t('leases.canoneConcordato.foglio')}>
            <Input value={foglio} onChange={(e) => setFoglio(e.target.value)} />
          </Field>
          <Field label={t('leases.canoneConcordato.years')}>
            <Input type="number" min={1} value={years} onChange={(e) => setYears(e.target.value)} required />
          </Field>
          <Field label={t('leases.canoneConcordato.typeA')}>
            <Input type="number" min={0} value={typeACount} onChange={(e) => setTypeACount(e.target.value)} required />
          </Field>
          <Field label={t('leases.canoneConcordato.typeB')}>
            <Input type="number" min={0} value={typeBCount} onChange={(e) => setTypeBCount(e.target.value)} required />
          </Field>
          <Field label={t('leases.canoneConcordato.typeC')}>
            <Input type="number" min={0} value={typeCCount} onChange={(e) => setTypeCCount(e.target.value)} required />
          </Field>
          <Field label={t('leases.canoneConcordato.typeD')}>
            <Input type="number" min={0} value={typeDCount} onChange={(e) => setTypeDCount(e.target.value)} required />
          </Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox id="furnished" checked={furnished} onCheckedChange={(v) => setFurnished(v === true)} />
            <Label htmlFor="furnished">{t('leases.canoneConcordato.furnished')}</Label>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={eligibility.isPending}>
              {eligibility.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('leases.canoneConcordato.calculating')}
                </>
              ) : (
                t('leases.canoneConcordato.calculate')
              )}
            </Button>
          </div>
        </form>

        {eligibility.isError && (
          <p className="text-sm text-destructive">{t('leases.canoneConcordato.error')}</p>
        )}

        {result && !result.available && (
          <p className="rounded-md border p-3 text-sm">
            {result.reason || t('leases.canoneConcordato.unavailable')}
          </p>
        )}

        {result?.available && (
          <div className="space-y-3 rounded-md border p-4 text-sm">
            <p>
              {t('leases.canoneConcordato.rangeYear')}:{' '}
              <strong>
                {formatCurrency(result.canoneMinAnnuo ?? 0)} – {formatCurrency(result.canoneMaxAnnuo ?? 0)}
              </strong>
            </p>
            <p>
              {t('leases.canoneConcordato.rangeMonth')}:{' '}
              {formatCurrency(result.canoneMinMensile ?? 0)} – {formatCurrency(result.canoneMaxMensile ?? 0)}
            </p>
            <p>
              {t('leases.canoneConcordato.subFascia')}: {result.subFascia} · {t('leases.canoneConcordato.zone')}: {result.zone}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Benefit
                title={t('leases.canoneConcordato.imuTitle')}
                body={
                  result.imuAppliesTheoretical
                    ? t('leases.canoneConcordato.imuTheoretical')
                    : t('leases.canoneConcordato.imuNo')
                }
              />
              <Benefit
                title={t('leases.canoneConcordato.ataTitle')}
                body={
                  result.ataApplies
                    ? t('leases.canoneConcordato.ataYes')
                    : t('leases.canoneConcordato.ataPending')
                }
              />
            </div>
            {result.attestationRequired && (
              <p>{t('leases.canoneConcordato.attestationRequired')}</p>
            )}
            <p className="text-muted-foreground">{result.disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Benefit({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md bg-muted/40 p-3">
      <p className="font-medium">{title}</p>
      <p className="text-muted-foreground">{body}</p>
    </div>
  );
}
