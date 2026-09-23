import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { getLeasePartyRoleLabel } from '@/lib/i18n-labels';
import type { SignerInfo } from '@/types';

interface LeaseSigningPanelProps {
  signers: SignerInfo[];
}

export function LeaseSigningPanel({ signers }: LeaseSigningPanelProps) {
  const { t } = useTranslation();

  if (signers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('leases.signingPanel.title')}</CardTitle>
        <CardDescription>{t('leases.signingPanel.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {signers.map((signer) => (
          <div
            key={signer.partyId}
            className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{signer.name}</span>
                <Badge variant="outline">{getLeasePartyRoleLabel(signer.role, t)}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {t('leases.signingPanel.expires', { date: formatDateTime(signer.expiresAt) })}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(signer.signingUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('leases.signingPanel.openLink')}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
