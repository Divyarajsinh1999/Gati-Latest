import { describe, it, expect } from 'vitest';
import { escapeCSVField, toCSV } from '../csvExport.js';

describe('escapeCSVField — RFC 4180 quoting', () => {
  it('leaves plain values untouched', () => {
    expect(escapeCSVField('RELIANCE.NS')).toBe('RELIANCE.NS');
    expect(escapeCSVField('1234.50')).toBe('1234.50');
  });

  it('quotes and doubles embedded double quotes', () => {
    expect(escapeCSVField('He said "buy"')).toBe('"He said ""buy"""');
  });

  it('quotes values containing a comma', () => {
    // A real case: NSE sector names include commas.
    expect(escapeCSVField('Oil, Gas & Consumable Fuels')).toBe('"Oil, Gas & Consumable Fuels"');
  });

  it('quotes values containing a newline OR a bare carriage return', () => {
    expect(escapeCSVField('line1\nline2')).toBe('"line1\nline2"');
    // The \r case is the easy one to miss — an unquoted bare CR splits the
    // row in most parsers even though there's no \n.
    expect(escapeCSVField('line1\rline2')).toBe('"line1\rline2"');
    expect(escapeCSVField('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('renders null and undefined as empty, never the strings "null"/"undefined"', () => {
    expect(escapeCSVField(null)).toBe('');
    expect(escapeCSVField(undefined)).toBe('');
  });

  it('stringifies numbers and zero correctly (0 must not become empty)', () => {
    expect(escapeCSVField(0)).toBe('0');
    expect(escapeCSVField(-3.85)).toBe('-3.85');
  });
});

describe('escapeCSVField — spreadsheet formula injection', () => {
  it('neutralises leading = and @ so a provider-supplied value cannot execute in Excel', () => {
    expect(escapeCSVField('=1+1')).toBe("'=1+1");
    expect(escapeCSVField('=HYPERLINK("http://evil","x")')).toBe('"\'=HYPERLINK(""http://evil"",""x"")"');
    expect(escapeCSVField('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('does NOT touch leading - or +, because signed numbers are the whole point of this file', () => {
    // Neutralising these would corrupt every negative return in the export
    // and stop the column parsing as numeric — a worse outcome than the
    // theoretical injection risk they carry.
    expect(escapeCSVField('-3.85')).toBe('-3.85');
    expect(escapeCSVField('+1.25')).toBe('+1.25');
    expect(escapeCSVField(-12.5)).toBe('-12.5');
  });
});

describe('toCSV', () => {
  it('emits a header row followed by data rows, CRLF-terminated', () => {
    const csv = toCSV([
      { Symbol: 'A', Return: '1.00' },
      { Symbol: 'B', Return: '-2.00' },
    ]);
    expect(csv).toBe('Symbol,Return\r\nA,1.00\r\nB,-2.00');
  });

  it('returns an empty string for empty, null, or non-array input rather than throwing', () => {
    expect(toCSV([])).toBe('');
    expect(toCSV(null)).toBe('');
    expect(toCSV(undefined)).toBe('');
    expect(toCSV([{}])).toBe('');
  });

  it('uses the UNION of keys across rows, so a later row cannot silently lose a column', () => {
    const csv = toCSV([{ A: 1 }, { A: 2, B: 3 }]);
    const [header, ...rows] = csv.split('\r\n');
    expect(header).toBe('A,B');
    expect(rows[0]).toBe('1,'); // missing B becomes an empty field, not a dropped column
    expect(rows[1]).toBe('2,3');
  });

  it('keeps column order stable and matching first-seen order', () => {
    const csv = toCSV([{ Rank: 1, Symbol: 'A', RS: '5.00' }]);
    expect(csv.split('\r\n')[0]).toBe('Rank,Symbol,RS');
  });

  it('escapes header names too, not just values', () => {
    const csv = toCSV([{ 'Benchmark (NIFTYBEES.NS) Return %': '1.00', 'A,B': 'x' }]);
    expect(csv.split('\r\n')[0]).toBe('Benchmark (NIFTYBEES.NS) Return %,"A,B"');
  });
});
