import { useAuthBridge } from '@/contexts/auth-bridge';

export function useAuth() {
  return useAuthBridge();
}
