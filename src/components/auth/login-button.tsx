import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export function LoginButton() {
  const { t } = useTranslation();
  const { login } = useAuth();

  return (
    <Button onClick={() => login()}>
      <LogIn className="mr-2 h-4 w-4" />
      {t('login.signIn')}
    </Button>
  );
}
