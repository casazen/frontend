import { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useGenerateSeoPages, usePlatformAiBudget, useSeoPages } from '@/queries/use-admin-seo';
import { SeoReviewStatusBadge } from './components/seo-review-status-badge';
import { formatDate } from '@/lib/utils';

export function SeoDashboardPage() {
  const { data, isLoading, isError } = useSeoPages({ page: 1, pageSize: 50 });
  const { data: budget } = usePlatformAiBudget();
  const generateMutation = useGenerateSeoPages();
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleRegenerate() {
    setConfirmOpen(false);
    await generateMutation.mutateAsync({
      comuneCodes: ['013075'],
      pageTypes: ['ComplianceGuide', 'TouristTaxCalc'],
      forceRegenerate: false,
    });
  }

  return (
    <div className="space-y-6" data-testid="seo-dashboard-page">
      <PageHeader
        title="SEO Compliance"
        description="Pagine programmatiche per affitti brevi e tassa di soggiorno"
        action={
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={generateMutation.isPending}
            data-testid="seo-regenerate-button"
          >
            Rigenera
          </Button>
        }
      />

      {budget && (
        <Card data-testid="seo-ai-budget-card">
          <CardHeader>
            <CardTitle>Budget AI piattaforma</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {budget.tokensUsedThisMonth.toLocaleString('it-IT')} /{' '}
            {budget.monthlyTokenCap.toLocaleString('it-IT')} token questo mese
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isError ? (
            <p className="py-8 text-center text-destructive">
              Impossibile caricare le pagine SEO. Riprova più tardi.
            </p>
          ) : isLoading ? (
            <p className="py-8 text-center text-muted-foreground">Caricamento…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="seo-pages-table">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Comune</th>
                    <th className="pb-2 pr-4">Tipo</th>
                    <th className="pb-2 pr-4">Stato</th>
                    <th className="pb-2">Ultimo refresh</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((item) => (
                    <tr
                      key={item.id}
                      className="border-b last:border-0"
                      data-testid={`seo-page-row-${item.id}`}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-medium">{item.comuneName}</div>
                        <div className="text-xs text-muted-foreground">{item.slug}</div>
                      </td>
                      <td className="py-3 pr-4">{item.pageType}</td>
                      <td className="py-3 pr-4">
                        <SeoReviewStatusBadge status={item.legalReviewStatus} />
                      </td>
                      <td className="py-3">
                        {item.lastRefreshedAt
                          ? formatDate(item.lastRefreshedAt)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data && data.items.length === 0 && (
                <p className="py-8 text-center text-muted-foreground">Nessuna pagina SEO.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent data-testid="seo-regenerate-dialog">
          <DialogHeader>
            <DialogTitle>Conferma rigenerazione</DialogTitle>
            <DialogDescription>
              Verrà accodato un job Hangfire per rigenerare le pagine SEO del comune di Como (013075).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annulla
            </Button>
            <Button onClick={() => void handleRegenerate()} data-testid="seo-regenerate-confirm">
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
