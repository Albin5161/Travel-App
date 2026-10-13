import { useEffect, useState } from 'react';

/**
 * Offline, once it has stayed that way a moment. A phone drops its connection for an instant when
 * it changes mast or leaves wifi, and a notice that blinked each time would cry wolf. Back online
 * is believed at once.
 */
export function useSettled(offline: boolean, ms = 1500): boolean {
  const [settled, setSettled] = useState(false);
  // Back online: forgotten straight away, so the next drop waits its moment again.
  if (!offline && settled) setSettled(false);
  useEffect(() => {
    if (!offline) return;
    const t = setTimeout(() => setSettled(true), ms);
    return () => clearTimeout(t);
  }, [offline, ms]);
  return settled && offline;
}
