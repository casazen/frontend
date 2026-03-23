import { isDemoMode } from '@/config/demo.config';
import { Info } from 'lucide-react';

export function DemoBanner() {
  if (!isDemoMode) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2">
      <Info className="w-4 h-4" />
      <span>Demo Mode - No authentication required. All data is simulated.</span>
    </div>
  );
}
