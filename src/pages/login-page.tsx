import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, LogIn } from 'lucide-react';

export function LoginPage() {
  const { isAuthenticated, user, login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/app/choose-context', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Home className="h-8 w-8" />
          </div>
          <CardTitle className="text-3xl">CASAZEN</CardTitle>
          <CardDescription>Vacation Property Management Platform</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Sign in to manage your properties, bookings, and payments
          </p>
          <Button onClick={() => login()} className="w-full" size="lg">
            <LogIn className="mr-2 h-5 w-5" />
            Sign in with Auth0
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
