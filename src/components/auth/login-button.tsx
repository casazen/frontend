import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { LogIn } from 'lucide-react';

export function LoginButton() {
  const { login } = useAuth();

  return (
    <Button onClick={() => login()}>
      <LogIn className="mr-2 h-4 w-4" />
      Login
    </Button>
  );
}
