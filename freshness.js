/**
 * Decides what the header should say about data freshness.
 *
 * Pulled out of TopBar into a pure function on purpose: "is the data we're
 * showing actually current?" is the single claim most likely to mislead a
 * user of a financial dashboard, and it was already gotten wrong once (the
 * header used to render `new Date()` as the data timestamp, so it always
 * claimed to be live). Logic that important should be unit-tested, not
 * embedded in JSX where the only verification is looking at it.
 *
 * @param {Object} args
 * @param {'OPEN'|'CLOSED'|'WEEKEND'|'HOLIDAY'} args.status  live market status
 * @param {string|null} args.dataAsOf   'YYYY-MM-DD' of the newest bar held
 * @param {string} args.todayIST        'YYYY-MM-DD' today in IST
 * @param {number|null} args.fetchedAt  epoch ms of last successful fetch
 * @param {string|null} args.providerId 'yahoo' | 'mock'
 *
 * @returns {{isLoaded:boolean, isStaleWhileOpen:boolean, isSynthetic:boolean,
 *            severity:'ok'|'info'|'warn', message:string}}
 */
export function describeDataFreshness({ status, dataAsOf, todayIST, fetchedAt, providerId }) {
  const isLoaded = fetchedAt != null;
  const isSynthetic = providerId === 'mock';

  if (!isLoaded) {
    return { isLoaded: false, isStaleWhileOpen: false, isSynthetic, severity: 'info', message: 'Loading market data…' };
  }

  // ISO date strings compare correctly with <, no parsing needed.
  const isStaleWhileOpen = status === 'OPEN' && dataAsOf != null && dataAsOf < todayIST;

  if (isStaleWhileOpen) {
    return {
      isLoaded: true,
      isStaleWhileOpen: true,
      isSynthetic,
      severity: 'warn',
      message: `Market is open but the newest data is from ${dataAsOf} — showing delayed prices.`,
    };
  }

  // Market closed and we hold that day's (or a prior) close: expected, not stale.
  if (status !== 'OPEN') {
    return {
      isLoaded: true,
      isStaleWhileOpen: false,
      isSynthetic,
      severity: 'ok',
      message: `Market closed. Showing the last available close (${dataAsOf ?? 'unknown date'}).`,
    };
  }

  return {
    isLoaded: true,
    isStaleWhileOpen: false,
    isSynthetic,
    severity: 'ok',
    message: `Live — data current as of ${dataAsOf ?? 'unknown date'}.`,
  };
}
