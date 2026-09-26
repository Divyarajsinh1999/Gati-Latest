/**
 * KEYBOARD SHORTCUTS.
 *
 * WHAT THIS OWNS
 *   A deliberately small set of single-key accelerators, and the list that
 *   documents them.
 *
 * WHAT THIS MUST NEVER DO
 *   Be the only way to do anything. Every shortcut here duplicates a visible
 *   control. A shortcut is an accelerator for people who already know the
 *   interface, never a hiding place for functionality.
 *
 * WHY SO FEW
 *   Seven is a set someone can hold in their head. Twenty is a manual nobody
 *   reads, and every extra binding is one more chance to steal a keystroke
 *   from a text field.
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { navDestinations, universePath } from '../config/routes.js';
import { UNIVERSE_KEYS } from '../config/universes.js';

export const SHORTCUTS = [
  { keys: ['1', '2', '3'], description: 'Switch universe' },
  { keys: ['r'], description: 'Reports' },
  { keys: [','], description: 'Settings' },
  { keys: ['a'], description: 'Focus the investment amount' },
  { keys: ['v'], description: 'View all stocks' },
  { keys: ['/'], description: 'Search' },
  { keys: ['?'], description: 'This list' },
  { keys: ['Esc'], description: 'Close whatever is open' },
];

/**
 * True when a keystroke belongs to whatever the user is typing into.
 *
 * Without this, typing "50000" into the amount field would navigate to three
 * different universes on the way. Also covers contenteditable and anything
 * that has opted out with `data-no-shortcuts`.
 */
function isTypingContext(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest?.('[data-no-shortcuts]'));
}

/**
 * @param {object} handlers
 * @param {() => void} [handlers.onFocusAmount]
 * @param {() => void} [handlers.onViewAll]
 * @param {() => void} [handlers.onSearch]
 * @param {() => void} [handlers.onShowShortcuts]
 */
export function useKeyboardShortcuts(handlers = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (event) => {
      // Modifier combinations belong to the browser and the operating system.
      // Claiming Cmd-R would be a hostile thing to do to a user.
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingContext(event.target)) return;

      const key = event.key;

      if (['1', '2', '3'].includes(key)) {
        const universeKey = UNIVERSE_KEYS[Number(key) - 1];
        if (universeKey) {
          event.preventDefault();
          navigate(universePath(universeKey));
        }
        return;
      }

      switch (key.toLowerCase()) {
        case 'r':
          event.preventDefault();
          navigate(navDestinations().find((d) => d.key === 'reports').path);
          break;
        case ',':
          event.preventDefault();
          navigate(navDestinations().find((d) => d.key === 'settings').path);
          break;
        case 'a':
          if (handlers.onFocusAmount) {
            event.preventDefault();
            handlers.onFocusAmount();
          }
          break;
        case 'v':
          if (handlers.onViewAll) {
            event.preventDefault();
            handlers.onViewAll();
          }
          break;
        case '/':
          if (handlers.onSearch) {
            event.preventDefault();
            handlers.onSearch();
          }
          break;
        case '?':
          if (handlers.onShowShortcuts) {
            event.preventDefault();
            handlers.onShowShortcuts();
          }
          break;
        default:
          break;
      }
    };

    globalThis.addEventListener?.('keydown', onKeyDown);
    return () => globalThis.removeEventListener?.('keydown', onKeyDown);
  }, [navigate, handlers]);
}
