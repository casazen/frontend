import { useTranslation } from 'react-i18next';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DnsInstructions } from '@/types/domain.types';

interface DnsInstructionsPanelProps {
  instructions: DnsInstructions;
}

interface RecordRowProps {
  testId: string;
  label: string;
  hint?: string;
  host: string;
  value: string;
  copyLabel: string;
  copyTestId?: string;
}

function RecordRow({ testId, label, hint, host, value, copyLabel, copyTestId }: RecordRowProps) {
  const { t } = useTranslation();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(t('domain.dns.copied'));
    } catch {
      // Clipboard blocked (insecure context, denied permission): the value stays on screen to copy by hand.
      toast.error(t('domain.dns.copyFailed'));
    }
  };

  return (
    <div className="space-y-1" data-testid={testId}>
      <p className="font-medium">{label}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <p className="break-all text-muted-foreground">
        <span className="font-mono">{host}</span> → <span className="font-mono">{value}</span>
      </p>
      <Button type="button" variant="outline" size="sm" data-testid={copyTestId} onClick={() => void copy()}>
        <Copy className="mr-2 h-4 w-4" />
        {copyLabel}
      </Button>
    </div>
  );
}

/**
 * The DNS records the host creates at their provider: the CNAME (or the A records for a domain without `www`), the TXT
 * that proves ownership and, only when the service provider asks for it, its own TXT (BK-17, A3-25).
 */
export function DnsInstructionsPanel({ instructions }: DnsInstructionsPanelProps) {
  const { t } = useTranslation();
  const aRecords = instructions.aRecordValues ?? [];

  return (
    <Card data-testid="dns-instructions-panel">
      <CardHeader>
        <CardTitle>{t('domain.dns.title')}</CardTitle>
        <CardDescription>{t('domain.dns.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <RecordRow
          testId="dns-record-txt"
          label={t('domain.dns.txt')}
          hint={t('domain.dns.txtHint')}
          host={instructions.txtHost}
          value={instructions.txtValue}
          copyLabel={t('domain.dns.copyTxt')}
          copyTestId="copy-txt-value"
        />

        <RecordRow
          testId="dns-record-cname"
          label={t('domain.dns.cname')}
          hint={t('domain.dns.cnameHint')}
          host={instructions.cnameHost}
          value={instructions.cnameTarget}
          copyLabel={t('domain.dns.copyCname')}
        />

        {aRecords.length > 0 && (
          <div className="space-y-1" data-testid="dns-record-a">
            <p className="font-medium">{t('domain.dns.aRecord')}</p>
            <p className="text-xs text-muted-foreground">{t('domain.dns.aRecordHint')}</p>
            <ul className="space-y-1 text-muted-foreground">
              {aRecords.map((address) => (
                <li key={address} className="break-all">
                  <span className="font-mono">{instructions.cnameHost}</span> → <span className="font-mono">{address}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {instructions.vercelTxtHost && instructions.vercelTxtValue && (
          <RecordRow
            testId="dns-record-provider-txt"
            label={t('domain.dns.providerTxt')}
            hint={t('domain.dns.providerTxtHint')}
            host={instructions.vercelTxtHost}
            value={instructions.vercelTxtValue}
            copyLabel={t('domain.dns.copyProviderTxt')}
            copyTestId="copy-provider-txt-value"
          />
        )}

        <p className="text-muted-foreground">{t('domain.dns.sslNote')}</p>
      </CardContent>
    </Card>
  );
}
