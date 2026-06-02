import { ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import type { SignerInfo } from '@/types';

interface LeaseSigningPanelProps {
  signers: SignerInfo[];
}

export function LeaseSigningPanel({ signers }: LeaseSigningPanelProps) {
  if (signers.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Digital signing</CardTitle>
        <CardDescription>
          Share each signing link with the corresponding party. Links expire at the
          indicated time.
        </CardDescription>
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
                <Badge variant="outline">{signer.role}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Expires {formatDateTime(signer.expiresAt)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(signer.signingUrl, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Open signing link
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
