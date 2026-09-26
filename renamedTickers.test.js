import { describe, it, expect } from 'vitest';
import { RENAMED_TICKERS, getRenameSuggestion } from '../renamedTickers.js';

describe('getRenameSuggestion', () => {
  it('returns null (not undefined) for a symbol with no known history', () => {
    // Uniform "no suggestion" whether the map has no entry at all, or an
    // explicit null replacement — callers shouldn't have to distinguish.
    expect(getRenameSuggestion('SOME_RANDOM_TICKER.NS')).toBeNull();
  });

  it('returns the recorded entry for a known case', () => {
    const result = getRenameSuggestion('TATAMOTORS.NS');
    expect(result).not.toBeNull();
    expect(result.suggestedReplacement).toBeNull();
    expect(result.note).toMatch(/demerger/i);
  });

  it('never suggests auto-adopting a replacement for the seeded case', () => {
    // TATAMOTORS.NS is confirmed dead with no config fix needed (NIFTY 50
    // already carries the correct successor, TMPV.NS). suggestedReplacement
    // staying null here is itself the safety property under test: nothing
    // downstream should ever be able to read a symbol out of this entry and
    // act on it unattended.
    expect(RENAMED_TICKERS['TATAMOTORS.NS'].suggestedReplacement).toBeNull();
  });
});
