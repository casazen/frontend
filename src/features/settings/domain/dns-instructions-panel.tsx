import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DnsInstructions } from '@/types/domain.types';
import { toast } from 'sonner';

interface DnsInstructionsPanelProps {
  instructions: DnsInstructions;
}

async function copyValue(value: string, label: string) {
  await navigator.clipboard.writeText(value);
  toast.success(label);
}

export function DnsInstructionsPanel({ instructions }: DnsInstructionsPanelProps) {
  const { t } = useTranslation();

  return (
    <Card data-testid="dns-instructions-panel">
      <CardHeader>
        <CardTitle>{t('domain.dns.title')}</CardTitle>
        <CardDescription>{t('domain.dns.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="font-medium">{t('domain.dns.cname')}</p>
          <p className="text-muted-foreground break-all">
            {instructions.cnameHost} → {instructions.cnameTarget}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copyValue(instructions.cnameTarget, t('domain.dns.copied'))}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t('domain.dns.copyCname')}
          </Button>
        </div>

        <div className="space-y-1">
          <p className="font-medium">{t('domain.dns.txt')}</p>
          <p className="text-muted-foreground break-all">
            {instructions.txtHost} = {instructions.txtValue}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="copy-txt-value"
            onClick={() => void copyValue(instructions.txtValue, t('domain.dns.copied'))}
          >
            <Copy className="mr-2 h-4 w-4" />
            {t('domain.dns.copyTxt')}
          </Button>
        </div>

        <p className="text-muted-foreground">{instructions.sslNote}</p>
      </CardContent>
    </Card>
  );
}
