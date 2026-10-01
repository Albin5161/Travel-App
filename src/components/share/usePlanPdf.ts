import { useState } from 'react';

import { getReel } from '@/data/api';
import type { TripPlan } from '@/data/planner';
import type { City } from '@/data/types';
import { track } from '@/lib/analytics';
import { haptic } from '@/lib/haptics';
import { savePlanPdf, type SaveResult } from '@/lib/share';
import { useTrips } from '@/state/trips';

/**
 * Saving a plan as a PDF, from any screen that shows one: who made the videos comes from the city's
 * collection.
 */
export function usePlanPdf(city: City | undefined, plan: TripPlan | undefined) {
  const { state } = useTrips();
  const [making, setMaking] = useState(false);

  const save = async (): Promise<SaveResult | 'failed' | null> => {
    if (!city || !plan || making) return null;
    haptic.light();
    setMaking(true);
    try {
      const reels = (state.collections[city.id]?.reelIds ?? []).map((id) => getReel(id));
      const creators = [...new Set(reels.map((r) => r?.creator).filter((c): c is string => !!c))];
      const result = await savePlanPdf({ city, plan, issued: new Date(), creators });
      if (result !== 'dismissed') {
        haptic.success();
        track('plan pdf saved', { how: result, days: plan.days.length });
      }
      return result;
    } catch {
      return 'failed';
    } finally {
      setMaking(false);
    }
  };

  return { making, save };
}
