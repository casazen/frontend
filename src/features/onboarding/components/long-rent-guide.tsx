import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeases } from '@/queries/use-leases';
import { useProperties } from '@/queries/use-properties';

const PROPERTY_PATH = '/app/long-rent/properties/new?first=1';
const LEASE_PATH = '/app/long-rent/leases/new';

/**
 * Guide of a new long-term landlord (the short-rent area has the server checklist of its dashboard): the first property,
 * then the first lease. Derived from what is stored, never from a click, and gone once both exist. While the data loads or
 * fails it shows nothing: a guide that says "todo" for a state it does not know is worse than no guide.
 */
export function LongRentGuide() {
  const { t } = useTranslation();
  const properties = useProperties();
  const leases = useLeases();

  if (!properties.data || !leases.data) return null;

  const steps = [
    { key: 'property', done: properties.data.length > 0, to: PROPERTY_PATH },
    // A lease needs a property: the second step waits for the first.
    { key: 'lease', done: leases.data.length > 0, to: properties.data.length > 0 ? LEASE_PATH : null },
  ] as const;
  if (steps.every((step) => step.done)) return null;

  const done = steps.filter((step) => step.done).length;
  return (
    <Card data-testid="long-rent-guide">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListChecks className="h-5 w-5" aria-hidden />
          {t('longRentGuide.title')}
        </CardTitle>
        <CardDescription>{t('longRentGuide.progress', { count: done, total: steps.length })}</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {steps.map((step) => (
            <li
              key={step.key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-3"
              data-testid={`long-rent-guide-${step.key}`}
              data-state={step.done ? 'done' : 'todo'}
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {step.done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" aria-hidden />
                ) : (
                  <Circle className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t(`longRentGuide.steps.${step.key}.title`)}</p>
                  <p className="text-xs text-muted-foreground">{t(`longRentGuide.steps.${step.key}.hint`)}</p>
                </div>
              </div>
              {!step.done && step.to && (
                <Button asChild size="sm" variant="outline">
                  <Link to={step.to}>{t(`longRentGuide.steps.${step.key}.cta`)}</Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
