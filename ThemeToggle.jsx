import { useTheme } from '../../hooks/useTheme.js';
import { IconLight, IconDark, IconSystem } from '../../design/icons.jsx';

const OPTIONS = [
  // Drawn icons, not typographic glyphs. D6 removed glyphs everywhere else
  // because they resolve to whichever font the platform picks — different
  // size, different baseline, uncontrollable stroke weight. This toggle was
  // missed at the time.
  { value: 'light', label: 'Light', Icon: IconLight },
  { value: 'dark', label: 'Dark', Icon: IconDark },
  { value: 'system', label: 'System', Icon: IconSystem },
];

/**
 * Theme switcher — three explicit choices, not a two-state flip.
 *
 * A binary sun/moon toggle can't express "follow my OS", which is what
 * most people actually want; offering it as a real third option means the
 * app tracks a scheduled dark mode instead of being stuck wherever the
 * user last tapped.
 *
 * Rendered as radios rather than buttons because that is what this is:
 * one selection out of three mutually exclusive options. Screen readers
 * then announce the group and the current choice for free. Labels are
 * hidden below `sm` — glyphs alone on a phone — but the accessible name
 * stays on the input, so it is never glyph-only to assistive tech.
 */
export function ThemeToggle() {
  const { preference, setPreference } = useTheme();

  return (
    <fieldset className="flex items-center rounded-full border border-[var(--color-line)] bg-[var(--color-surface-raised)] p-0.5">
      <legend className="sr-only">Colour theme</legend>
      {OPTIONS.map((option) => {
        const selected = preference === option.value;
        return (
          <label
            key={option.value}
            className={`flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selected
                ? 'bg-[var(--color-gold-fill)] text-[var(--color-on-gold)]'
                : 'text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            <input
              type="radio"
              name="theme-preference"
              value={option.value}
              checked={selected}
              onChange={() => setPreference(option.value)}
              className="sr-only"
            />
            <option.Icon size={16} />
            <span className="hidden sm:inline">{option.label}</span>
            <span className="sr-only sm:hidden">{option.label}</span>
          </label>
        );
      })}
    </fieldset>
  );
}
