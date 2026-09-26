/**
 * Market data provider contract (spec Section 5: "design the market-data
 * layer so another provider can replace Yahoo Finance later without
 * rewriting the strategy or UI").
 *
 * Every provider — Yahoo Finance today, something else tomorrow — must
 * implement these three methods with these exact return shapes. Nothing in
 * src/engine or src/pages should ever import a specific provider directly;
 * always go through data/dataService.js.
 */
export class MarketDataProvider {
  /**
   * BATCHED historical data — the primary path since v0.22.0.
   *
   * One call carries up to MAX_SYMBOLS_PER_REQUEST symbols, so a 250-symbol
   * universe costs ~7 requests instead of 250. Yahoo's chart endpoint is
   * single-symbol upstream, so the fan-out still happens — but server-side,
   * from one warm instance, rather than as 250 cold client requests.
   *
   * MUST NOT REJECT FOR A SINGLE BAD SYMBOL. Returns one entry per requested
   * symbol: `{ records }` on success, `{ error }` on failure. One dead ticker
   * costs one row; rejecting the batch would throw away 39 good series.
   *
   * @param {string[]} symbols
   * @param {string} startDate ISO 'YYYY-MM-DD'
   * @param {string} endDate ISO 'YYYY-MM-DD'
   * @returns {Promise<Map<string, {records?: Array<object>, error?: string}>>}
   */
  // eslint-disable-next-line no-unused-vars
  async getHistoricalDataBatch(symbols, startDate, endDate) {
    throw new Error('getHistoricalDataBatch not implemented');
  }

  /**
   * SINGLE-SYMBOL historical data. Retained for test doubles and for any
   * alias and for test doubles written against the original contract; the data
   * service prefers getHistoricalDataBatch whenever a provider offers it.
   *
   * @param {string} symbol e.g. 'RELIANCE.NS'
   * @param {string} startDate ISO 'YYYY-MM-DD'
   * @param {string} endDate ISO 'YYYY-MM-DD'
   * @returns {Promise<Array<{date:string, open:number, high:number, low:number, close:number, adjClose:number, volume:number}>>}
   *          Ascending by date. Missing fields should be omitted, not
   *          fabricated as 0 — see engine/momentum.js's fallback handling.
   */
  // eslint-disable-next-line no-unused-vars
  async getHistoricalData(symbol, startDate, endDate) {
    throw new Error('getHistoricalData not implemented');
  }

  /**
   * @param {string[]} symbols
   * @returns {Promise<Map<string, {price:number, changePct:number, asOf:string, isStale:boolean}>>}
   */
  // eslint-disable-next-line no-unused-vars
  async getLatestQuotes(symbols) {
    throw new Error('getLatestQuotes not implemented');
  }

  /** @returns {string} short id used in data-quality/debug messages, e.g. 'yahoo' | 'mock' */
  get id() {
    throw new Error('id not implemented');
  }
}
