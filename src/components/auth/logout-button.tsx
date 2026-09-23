import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface LogoutButtonProps {
  variant?: "default" | "ghost" | "outline";
}

export function LogoutButton({ variant = "ghost" }: LogoutButtonProps) {
  const { t } = useTranslation();
  const { logout } = useAuth();

  return (
    <Button variant={variant} onClick={() => logout()}>
      <LogOut className="mr-2 h-4 w-4" />
      {t('shared.userMenu.logout')}
    </Button>
  );
}
