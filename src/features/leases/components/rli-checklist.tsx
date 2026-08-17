import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useExportRli, useRliChecklist } from '@/queries/use-leases';

interface Props {
  leaseId: string;
}

export function RliChecklist({ leaseId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useRliChecklist(leaseId);
  const exportRli = useExportRli();

  const handleExport = async () => {
    try {
      const blob = await exportRli.mutateAsync(leaseId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rli-prefill-${leaseId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(t('leases.rli.exportOk'));
    } catch {
      toast.error(t('leases.rli.exportError'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.rli.checklistTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading && <p>{t('leases.rli.checklistLoading')}</p>}
        {isError && <p className="text-destructive">{t('leases.rli.checklistError')}</p>}
        {data && (
          <>
            <p>
              {t('leases.rli.countdown', { days: data.daysRemaining })}
            </p>
            {data.items.length === 0 ? (
              <p className="text-muted-foreground">{t('leases.rli.checklistEmpty')}</p>
            ) : (
              <ul className="space-y-2">
                {data.items.map((item) => (
                  <li key={item.key} className="flex gap-2">
                    <span aria-hidden>{item.done ? '✓' : '○'}</span>
                    <span>{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
            <Button type="button" variant="outline" disabled={exportRli.isPending} onClick={handleExport}>
              {exportRli.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('leases.rli.exporting')}
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  {t('leases.rli.export')}
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
