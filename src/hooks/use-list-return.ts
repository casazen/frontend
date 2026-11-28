import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { rememberList } from '@/lib/list-return';

export function useListReturn(listKey: string): void {
  const { search } = useLocation();

  useEffect(() => {
    rememberList(listKey, search);
  }, [listKey, search]);
}
