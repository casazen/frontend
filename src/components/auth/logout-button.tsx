import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

interface LogoutButtonProps {
  variant?: "default" | "ghost" | "outline";
}

export function LogoutButton({ variant = "ghost" }: LogoutButtonProps) {
  const { logout } = useAuth();

  return (
    <Button variant={variant} onClick={() => logout()}>
      <LogOut className="mr-2 h-4 w-4" />
      Logout
    </Button>
  );
}
