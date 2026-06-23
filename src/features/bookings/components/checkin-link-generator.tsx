import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { bookingsApi } from '@/api/bookings.api';
import { copyTextToClipboard } from '@/lib/utils';
import { Link, Copy, Mail, Loader2, Check } from 'lucide-react';

interface CheckinLinkGeneratorProps {
  bookingId: string;
  guestEmail?: string;
}

export function CheckinLinkGenerator({ bookingId, guestEmail }: CheckinLinkGeneratorProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [emailTo, setEmailTo] = useState(guestEmail ?? '');

  const generateMutation = useMutation({
    mutationFn: () => bookingsApi.generateCheckInToken(bookingId),
    onSuccess: (data) => {
      setGeneratedToken(data.token);
      toast.success(t('checkin.linkGenerated'));
    },
    onError: () => {
      toast.error('Failed to generate check-in link. Please try again.');
    },
  });

  const checkinUrl = generatedToken
    ? `${window.location.origin}/checkin/${generatedToken}`
    : null;

  const handleCopy = async () => {
    if (!checkinUrl) return;
    await copyTextToClipboard(checkinUrl);
    setCopied(true);
    toast.success('Link copiato');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendEmail = () => {
    if (!checkinUrl || !emailTo) return;
    const subject = encodeURIComponent('Check-in CasaZen');
    const body = encodeURIComponent(
      `Gentile ospite,\n\nClicca sul link sottostante per completare il check-in:\n\n${checkinUrl}\n\nCasaZen`
    );
    window.open(`mailto:${emailTo}?subject=${subject}&body=${body}`, '_blank');
    toast.success('Apertura client email...');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link className="mr-2 h-4 w-4" />
          {t('checkin.sendLink')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('checkin.sendLink')}</DialogTitle>
          <DialogDescription>
            Genera un link di check-in da inviare all'ospite per la compilazione dei dati.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!generatedToken ? (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Clicca il pulsante per generare un link di check-in univoco.
              </p>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Link className="mr-2 h-4 w-4" />
                )}
                Genera link
              </Button>
            </div>
          ) : (
            <>
              {/* Generated Link */}
              <div className="space-y-2">
                <Label>{t('checkin.linkGenerated')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={checkinUrl ?? ''}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    title={t('checkin.copyLink')}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Email Section */}
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="guest-email">{t('checkin.guestEmail')}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="guest-email"
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="ospite@esempio.com"
                  />
                  <Button
                    variant="outline"
                    onClick={handleSendEmail}
                    disabled={!emailTo}
                    title={t('checkin.sendEmail')}
                  >
                    <Mail className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Inserisci l'email dell'ospite per inviare il link tramite il tuo client di posta.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
