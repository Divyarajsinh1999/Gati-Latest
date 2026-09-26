/**
 * Market universe configuration — the single source of truth for which
 * stocks belong to which universe and which benchmark each is measured
 * against (spec Section 3: "Keep benchmark symbols configurable rather than
 * scattering them throughout the code"). Nothing else in the codebase should
 * hardcode a stock list or a benchmark ticker — import from here.
 *
 * DATA PROVENANCE — read before treating this as ground truth:
 *  - NIFTY 50: verified against NSE's own constituent table (via Wikipedia's
 *    mirror of the official NSE PDF/CSV) as of 8 Dec 2025, cross-checked
 *    against live weightage data dated 27 Jul 2026. All 50 names present.
 *  - Midcap 150 / Smallcap 250: NSE reconstitutes these indices semi-annually
 *    (cut-off Jan 31 / Jul 31) and does not publish a scrape-friendly plain
 *    list — only a CSV at the official URLs below. Only the ~8 names below
 *    that could be verified from a live, dated source are included; the
 *    rest are intentionally left out rather than guessed. See
 *    `meta.constituentStatus` and scripts/import-constituents.md for how to
 *    complete these from the official file.
 *
 * Both benchmark tickers were confirmed as live, actively-quoted Yahoo
 * Finance symbols (NIFTYMIDCAP150.NS, NIFTYSMLCAP250.NS quote the raw index
 * level, same as NIFTYBEES.NS quotes the Nifty 50 ETF) — so the spec's
 * benchmark symbols are usable as given.
 */

import { MIDCAP150_STOCKS, SMALLCAP250_STOCKS } from './constituents.generated.js';

export const UNIVERSE_KEYS = ['nifty50', 'midcap150', 'smallcap250'];

export const UNIVERSES = {
  nifty50: {
    key: 'nifty50',
    label: 'NIFTY 50',
    shortLabel: 'Large Cap',
    benchmark: { symbol: 'NIFTYBEES.NS', label: 'Nippon India ETF Nifty BeES' },
    meta: {
      constituentStatus: 'complete',
      expectedCount: 50,
      asOf: '2025-12-08',
      sourceUrl: 'https://www.niftyindices.com/IndexConstituent/ind_nifty50list.csv',
    },
    stocks: [
      { symbol: 'ADANIENT.NS', name: 'Adani Enterprises', sector: 'Metals & Mining' },
      { symbol: 'ADANIPORTS.NS', name: 'Adani Ports & SEZ', sector: 'Services' },
      { symbol: 'APOLLOHOSP.NS', name: 'Apollo Hospitals', sector: 'Healthcare' },
      { symbol: 'ASIANPAINT.NS', name: 'Asian Paints', sector: 'Consumer Durables' },
      { symbol: 'AXISBANK.NS', name: 'Axis Bank', sector: 'Financial Services' },
      { symbol: 'BAJAJ-AUTO.NS', name: 'Bajaj Auto', sector: 'Automobile & Auto Components' },
      { symbol: 'BAJFINANCE.NS', name: 'Bajaj Finance', sector: 'Financial Services' },
      { symbol: 'BAJAJFINSV.NS', name: 'Bajaj Finserv', sector: 'Financial Services' },
      { symbol: 'BEL.NS', name: 'Bharat Electronics', sector: 'Capital Goods' },
      { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel', sector: 'Telecommunication' },
      { symbol: 'CIPLA.NS', name: 'Cipla', sector: 'Healthcare' },
      { symbol: 'COALINDIA.NS', name: 'Coal India', sector: 'Oil, Gas & Consumable Fuels' },
      { symbol: 'DRREDDY.NS', name: "Dr. Reddy's Laboratories", sector: 'Healthcare' },
      { symbol: 'EICHERMOT.NS', name: 'Eicher Motors', sector: 'Automobile & Auto Components' },
      { symbol: 'ETERNAL.NS', name: 'Eternal', sector: 'Consumer Services' },
      { symbol: 'GRASIM.NS', name: 'Grasim Industries', sector: 'Construction Materials' },
      { symbol: 'HCLTECH.NS', name: 'HCLTech', sector: 'Information Technology' },
      { symbol: 'HDFCBANK.NS', name: 'HDFC Bank', sector: 'Financial Services' },
      { symbol: 'HDFCLIFE.NS', name: 'HDFC Life', sector: 'Financial Services' },
      { symbol: 'HINDALCO.NS', name: 'Hindalco Industries', sector: 'Metals & Mining' },
      { symbol: 'HINDUNILVR.NS', name: 'Hindustan Unilever', sector: 'Fast Moving Consumer Goods' },
      { symbol: 'ICICIBANK.NS', name: 'ICICI Bank', sector: 'Financial Services' },
      { symbol: 'INDIGO.NS', name: 'IndiGo', sector: 'Services' },
      { symbol: 'INFY.NS', name: 'Infosys', sector: 'Information Technology' },
      { symbol: 'ITC.NS', name: 'ITC', sector: 'Fast Moving Consumer Goods' },
      { symbol: 'JIOFIN.NS', name: 'Jio Financial Services', sector: 'Financial Services' },
      { symbol: 'JSWSTEEL.NS', name: 'JSW Steel', sector: 'Metals & Mining' },
      { symbol: 'KOTAKBANK.NS', name: 'Kotak Mahindra Bank', sector: 'Financial Services' },
      { symbol: 'LT.NS', name: 'Larsen & Toubro', sector: 'Construction' },
      { symbol: 'M&M.NS', name: 'Mahindra & Mahindra', sector: 'Automobile & Auto Components' },
      { symbol: 'MARUTI.NS', name: 'Maruti Suzuki', sector: 'Automobile & Auto Components' },
      { symbol: 'MAXHEALTH.NS', name: 'Max Healthcare', sector: 'Healthcare' },
      { symbol: 'NESTLEIND.NS', name: 'Nestlé India', sector: 'Fast Moving Consumer Goods' },
      { symbol: 'NTPC.NS', name: 'NTPC', sector: 'Power' },
      { symbol: 'ONGC.NS', name: 'Oil & Natural Gas Corporation', sector: 'Oil, Gas & Consumable Fuels' },
      { symbol: 'POWERGRID.NS', name: 'Power Grid Corporation', sector: 'Power' },
      { symbol: 'RELIANCE.NS', name: 'Reliance Industries', sector: 'Oil, Gas & Consumable Fuels' },
      { symbol: 'SBILIFE.NS', name: 'SBI Life Insurance', sector: 'Financial Services' },
      { symbol: 'SHRIRAMFIN.NS', name: 'Shriram Finance', sector: 'Financial Services' },
      { symbol: 'SBIN.NS', name: 'State Bank of India', sector: 'Financial Services' },
      { symbol: 'SUNPHARMA.NS', name: 'Sun Pharmaceutical', sector: 'Healthcare' },
      { symbol: 'TCS.NS', name: 'Tata Consultancy Services', sector: 'Information Technology' },
      { symbol: 'TATACONSUM.NS', name: 'Tata Consumer Products', sector: 'Fast Moving Consumer Goods' },
      { symbol: 'TMPV.NS', name: 'Tata Motors Passenger Vehicles', sector: 'Automobile & Auto Components' },
      { symbol: 'TATASTEEL.NS', name: 'Tata Steel', sector: 'Metals & Mining' },
      { symbol: 'TECHM.NS', name: 'Tech Mahindra', sector: 'Information Technology' },
      { symbol: 'TITAN.NS', name: 'Titan Company', sector: 'Consumer Durables' },
      { symbol: 'TRENT.NS', name: 'Trent', sector: 'Consumer Services' },
      { symbol: 'ULTRACEMCO.NS', name: 'UltraTech Cement', sector: 'Construction Materials' },
      { symbol: 'WIPRO.NS', name: 'Wipro', sector: 'Information Technology' },
    ],
  },

  midcap150: {
    key: 'midcap150',
    label: 'NIFTY Midcap 150',
    shortLabel: 'Mid Cap',
    benchmark: { symbol: 'NIFTYMIDCAP150.NS', label: 'NIFTY Midcap 150 (index level)' },
    meta: {
      constituentStatus: 'complete',
      provenance: 'third-party-mirror',
      expectedCount: 150,
      verifiedCount: 150,
      asOf: '2026-07-30',
      sourceUrl: 'https://www.niftyindices.com/IndexConstituent/ind_niftymidcap150list.csv',
      sources: [
        'DERIVED: (Nifty MidSmallcap 400 - Nifty Smallcap 250), an identity that holds by index construction',
        'github.com/AkhilB21/nse-constituents (third-party mirror; validated, see notes below)',
        'Cross-checked against official niftyindices.com factsheet PDFs previously verified in this project',
      ],
    },
    stocks: MIDCAP150_STOCKS,
  },

  smallcap250: {
    key: 'smallcap250',
    label: 'NIFTY Smallcap 250',
    shortLabel: 'Small Cap',
    benchmark: { symbol: 'NIFTYSMLCAP250.NS', label: 'NIFTY Smallcap 250 (index level)' },
    meta: {
      constituentStatus: 'complete',
      provenance: 'third-party-mirror',
      expectedCount: 250,
      verifiedCount: 250,
      asOf: '2026-07-30',
      sourceUrl: 'https://www.niftyindices.com/IndexConstituent/ind_niftysmallcap250list.csv',
      sources: [
        'github.com/AkhilB21/nse-constituents (third-party mirror; validated, see notes below)',
        'Cross-checked against official niftyindices.com factsheet PDFs previously verified in this project',
      ],
    },
    stocks: SMALLCAP250_STOCKS,
  }
};

export function getUniverse(key) {
  const universe = UNIVERSES[key];
  if (!universe) throw new Error(`Unknown universe key: ${key}`);
  return universe;
}

export function isUniverseComplete(key) {
  return UNIVERSES[key]?.meta.constituentStatus === 'complete';
}
