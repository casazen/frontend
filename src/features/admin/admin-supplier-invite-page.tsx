import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useInviteSupplier } from '@/queries/use-supplier';

export function AdminSupplierInvitePage() {
  const invite = useInviteSupplier();
  const [email, setEmail] = useState('');
  const [comuneCode, setComuneCode] = useState('');
  const [message, setMessage] = useState('');

  const submit = async () => {
    try {
      const result = await invite.mutateAsync({
        email,
        comuneCode,
        categories: ['Pulizie'],
        message: message || undefined,
      });
      toast.success(`Invito inviato — scade ${new Date(result.expiresAt).toLocaleDateString('it-IT')}`);
      setEmail('');
      setComuneCode('');
      setMessage('');
    } catch {
      toast.error('Impossibile inviare l\'invito');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Invita fornitore" description="Invia un invito pilota per comune" />
      <Card>
        <CardHeader>
          <CardTitle>Nuovo invito</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="comune">Codice comune</Label>
            <Input id="comune" value={comuneCode} onChange={(e) => setComuneCode(e.target.value)} placeholder="H501" />
          </div>
          <div>
            <Label htmlFor="message">Messaggio (opzionale)</Label>
            <Input id="message" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button onClick={() => void submit()} disabled={invite.isPending || !email || !comuneCode}>
            Invia invito
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
