import { useEffect, useState } from 'react';
import { getMarketStatus, nowInIST } from '../engine/tradingCalendar.js';

/** Re-derives market status every 30s so the header pill stays live without a full page reload. */
export function useMarketStatus() {
  const [status, setStatus] = useState(() => getMarketStatus());

  useEffect(() => {
    const tick = () => setStatus(getMarketStatus(nowInIST()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  return status;
}
