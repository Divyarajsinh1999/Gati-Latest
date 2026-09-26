/**
 * CSV generation and download.
 *
 * `toCSV` is deliberately separated from `downloadCSV` so the string
 * building — where the actual correctness risk lives — is a pure function
 * that can be unit-tested, while the DOM/Blob side effects stay in a thin
 * wrapper. Exported values must match what's rendered on screen (spec
 * Section 28), so callers pass the same formatted/rounded numbers the
 * tables show, not raw floating-point internals.
 */

/**
 * Escapes one field per RFC 4180.
 *
 * Quoting covers `"`, `,`, and BOTH line terminators. `\r` matters and is
 * easy to miss: a value containing a bare carriage return but no newline
 * would otherwise be emitted unquoted and split the row.
 *
 * FORMULA INJECTION: a field beginning with `=` or `@` is interpreted as a
 * formula by Excel and Google Sheets, so a hostile or merely odd value
 * arriving from the market-data provider could execute on open. Those get
 * a leading apostrophe, which spreadsheets strip on display.
 *
 * `-` and `+` are deliberately NOT neutralised even though they're on the
 * usual injection list: this file's whole job is exporting signed numbers
 * like `-3.85`, and prefixing those would break every negative return in
 * the file and stop the column parsing as numeric. The `=`/`@` cases can't
 * collide with a number, so they're safe to guard.
 */
export function escapeCSVField(value) {
  const str = value == null ? '' : String(value);
  const guarded = /^[=@]/.test(str) ? `'${str}` : str;
  return /["\r\n,]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/**
 * Builds a CSV string from an array of flat objects.
 *
 * Column set is the UNION of keys across all rows, not just the first
 * row's, so a row carrying an extra field can't silently lose it. Missing
 * values become empty fields. Returns '' for empty input.
 *
 * Line terminator is CRLF, which is what RFC 4180 specifies and what Excel
 * expects most reliably across platforms.
 */
export function toCSV(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const headers = [];
  const seen = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row ?? {})) {
      if (!seen.has(key)) {
        seen.add(key);
        headers.push(key);
      }
    }
  }
  if (headers.length === 0) return '';

  const lines = [
    headers.map(escapeCSVField).join(','),
    ...rows.map((row) => headers.map((h) => escapeCSVField(row?.[h])).join(',')),
  ];
  return lines.join('\r\n');
}

/** Triggers a browser download of `rows` as a CSV file. No-op for empty input. */
export function downloadCSV(filename, rows) {
  const csv = toCSV(rows);
  if (!csv) return;

  // Prepend a UTF-8 BOM so Excel on Windows reads non-ASCII correctly —
  // relevant here because company names can carry accented characters
  // (e.g. Nestlé India) and would otherwise render as mojibake.
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
