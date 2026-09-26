/**
 * "pp" MUST NOT REACH THE READER.
 *
 * Owner decision, 8 Aug 2026, restated the same day: every percentage the
 * interface shows uses a `%` sign. Relative Strength and outperformance are
 * arithmetically percentage POINTS and the app used to suffix them `pp` for
 * that reason — the reasoning is preserved in `formatGap`, and the meaning
 * is now carried by the glossary rather than by a suffix most readers do
 * not know.
 *
 * This test exists because that convention lives in a dozen selectors, two
 * chart formatters and five CSV headers. It came back once already during
 * this very change, in a chart tick formatter nobody was looking at.
 *
 * SCOPE: display strings and CSV headers only. Internal identifiers
 * (`TREND_BAND_PP`, `outperformancePct`) are deliberately untouched —
 * renaming engine internals is risk with no reader-visible benefit.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const SRC = resolve(process.cwd(), 'src');

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(jsx?|tsx?)$/.test(entry.name) ? [full] : [];
  });
}

/**
 * Strips block and line comments.
 *
 * Prose ABOUT the convention is allowed and wanted — `formatGap`'s comment
 * explains why the values are points, and deleting that explanation to
 * satisfy a lint rule would be the wrong trade. Only emitted strings matter.
 */
function codeWithoutComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

describe('no "pp" in anything the reader sees', () => {
  const files = sourceFiles(SRC);

  it('finds source files to check at all', () => {
    // A broken walker would make every assertion below vacuously true.
    expect(files.length).toBeGreaterThan(50);
  });

  it('emits no numeric pp suffix from any template or string literal', () => {
    const offenders = [];
    for (const file of files) {
      const code = codeWithoutComments(readFileSync(file, 'utf8'));
      // `}pp`      — end of a template expression, e.g. `${x.toFixed(1)}pp`
      // `1pp`      — a literal figure
      // `(pp)`     — a CSV column header
      // ` pp'`     — a unit at the end of a string
      for (const pattern of [/\}pp/, /\dpp\b/, /\(pp\)/, /\bpp['"`]/]) {
        const match = code.match(pattern);
        if (match) offenders.push(`${file.replace(`${SRC}/`, 'src/')}: ${match[0]}`);
      }
    }
    expect(offenders, `pp reaches the reader from:\n${offenders.join('\n')}`).toEqual([]);
  });

  it("offers no 'pp' unit through the shared percentage formatter", () => {
    const formatters = readFileSync(join(SRC, 'utils/formatters.js'), 'utf8');
    // The old signature accepted `unit: 'pp'`, which is how it spread.
    expect(codeWithoutComments(formatters)).not.toMatch(/'pp'/);
  });
});
