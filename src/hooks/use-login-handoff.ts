import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

type HandoffStatus = 'idle' | 'pending' | 'failed' | 'delayed';
type LoginOptions = Parameters<ReturnType<typeof useAuth>['login']>[0];

export function useLoginHandoff() {
  const { login } = useAuth();
  const [status, setStatus] = useState<HandoffStatus>('idle');
  const pending = useRef(false);
  const sequence = useRef(0);

  useEffect(() => {
    if (status !== 'pending') return;
    const timeout = window.setTimeout(() => {
      pending.current = false;
      setStatus('delayed');
    }, 15_000);
    return () => window.clearTimeout(timeout);
  }, [status]);

  const start = useCallback((options?: LoginOptions) => {
    if (pending.current) return;
    pending.current = true;
    const attempt = ++sequence.current;
    setStatus('pending');
    const failed = () => {
      if (sequence.current !== attempt) return;
      pending.current = false;
      setStatus('failed');
    };
    try {
      void Promise.resolve(login(options)).catch(failed);
    } catch {
      failed();
    }
  }, [login]);

  return { start, status, busy: status === 'pending' };
}
