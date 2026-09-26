import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

/**
 * ESLint — correctness rules plus ARCHITECTURAL LAYER ENFORCEMENT.
 *
 * The original config was deliberately minimal ("don't over-engineer"), and the
 * correctness half below is unchanged: unused imports/variables (caught a real
 * bug twice) and React Hooks violations (easy to introduce, hard to see).
 *
 * WHAT'S NEW (v0.21.0, Phase 5 milestone M1): the layer boundaries from the
 * approved architecture are now MECHANICALLY ENFORCED rather than documented
 * and hoped for. Enforced from day one they cost nothing; retrofitted later
 * they cost a week, and by then the violations are load-bearing.
 *
 * THE LAYER MODEL, and one clarification:
 *
 *     presentation  →  view state  →  orchestration  →  engines  →  data
 *
 * `config/` is NOT a layer in that stack — it is a DEPENDENCY-FREE LEAF that
 * any layer may import. It contains data (universe lists, benchmark symbols,
 * constants, holidays) and never behaviour, so it cannot create a cycle. The
 * architecture document draws it as a layer for readability; in dependency
 * terms it is a leaf, and that is how it is enforced here.
 *
 * WHAT IS ENFORCED TODAY (these all pass on the existing source, unchanged):
 *   - engines are PURE: no React, no data layer, no hooks, no components
 *   - config is a LEAF: it imports nothing but itself
 *   - the data layer has NO domain knowledge and no React
 *
 * WHAT IS PRE-ARMED BUT NOT YET ACTIVE:
 *   `screens/` and `selectors/` do not exist yet — they arrive with milestone
 *   M5/M6. Their rules are written now so the boundary is enforced from the
 *   FIRST file placed there, rather than being introduced after the violations
 *   already exist. The existing `components/` and `pages/` folders are
 *   deliberately NOT restricted yet: several of them legitimately import
 *   engines today, and that is resolved by the selector layer in M6, not by a
 *   lint rule that would fail the baseline build.
 */

/** Import specifiers that mean "this module reached up out of its layer". */
const REACT_WORLD = [
  { name: 'react', message: 'Engines and the data layer must stay free of React.' },
  { name: 'react-dom', message: 'Engines and the data layer must stay free of React.' },
  { name: 'react-router-dom', message: 'Routing is a presentation concern.' },
  { name: '@tanstack/react-query', message: 'Query orchestration belongs in queries/ and hooks/, not below them.' },
  { name: 'recharts', message: 'Charting is a presentation concern.' },
];

const pattern = (folder, why) => ({
  group: [`../${folder}/*`, `../../${folder}/*`, `../../../${folder}/*`, `**/src/${folder}/*`],
  message: why,
});

export default [
  js.configs.recommended,

  {
    files: ['src/**/*.{js,jsx}', 'netlify/**/*.{js,mjs}', 'scripts/**/*.mjs', 'tests/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        Response: 'readonly',
        Request: 'readonly',
        // Compiled in by vite.config.js `define` — see buildStamp().
        __APP_VERSION__: 'readonly',
        __BUILD_TIME__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  {
    // ---- ENGINE PURITY -----------------------------------------------------
    // The single most important boundary in the codebase. Engines are pure,
    // synchronous and dependency-light, which is what makes the financial
    // logic exhaustively testable without a network — and what makes moving
    // the heavy compute pass into a Web Worker a configuration change rather
    // than a refactor. Both properties evaporate the moment an engine reaches
    // sideways for a hook or a fetch.
    files: ['src/engine/**/*.js'],
    ignores: ['src/engine/**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: REACT_WORLD,
        patterns: [
          pattern('data', 'Engines must not fetch. Take the data as an argument instead.'),
          pattern('hooks', 'Engines must not depend on React state.'),
          pattern('components', 'Engines must not know about the UI.'),
          pattern('pages', 'Engines must not know about the UI.'),
          pattern('screens', 'Engines must not know about the UI.'),
          pattern('queries', 'Engines must not orchestrate fetching.'),
        ],
      }],
    },
  },

  {
    // ---- CONFIG IS A LEAF ---------------------------------------------------
    // config/ holds DATA, never behaviour. Adding a universe or a strategy must
    // be an entry in a file, not a code change anywhere else — which only stays
    // true if config itself depends on nothing.
    files: ['src/config/**/*.js'],
    ignores: ['src/config/**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: REACT_WORLD,
        patterns: [
          pattern('engine', 'config/ holds data, not behaviour. A conditional here is a bug.'),
          pattern('data', 'config/ must not fetch.'),
          pattern('hooks', 'config/ must not depend on React.'),
          pattern('components', 'config/ must not know about the UI.'),
          pattern('utils', 'config/ must stay dependency-free; inline the value instead.'),
        ],
      }],
    },
  },

  {
    // ---- DATA LAYER HAS NO DOMAIN KNOWLEDGE --------------------------------
    // The data layer answers "where do numbers come from", never "what do they
    // mean". Keeping the engines out of it is what makes a provider swap a
    // single-file change.
    files: ['src/data/**/*.js'],
    ignores: ['src/data/**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: REACT_WORLD,
        patterns: [
          pattern('engine', 'The data layer fetches and normalises; it must not calculate.'),
          pattern('hooks', 'The data layer must not depend on React state.'),
          pattern('components', 'The data layer must not know about the UI.'),
          pattern('pages', 'The data layer must not know about the UI.'),
          pattern('screens', 'The data layer must not know about the UI.'),
        ],
      }],
    },
  },

  {
    // ---- PRE-ARMED: SCREENS NEVER CALCULATE --------------------------------
    // Arrives with M5/M6. Screens compose; selectors shape; engines calculate.
    // A screen that imports an engine has put a financial calculation in the
    // UI, which the architecture forbids outright.
    files: ['src/screens/**/*.{js,jsx}'],
    ignores: ['src/screens/**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          pattern('engine', 'Screens must not calculate. Use a selector.'),
          pattern('data', 'Screens must not fetch directly. Use a query hook.'),
        ],
      }],
    },
  },

  {
    // ---- PRE-ARMED: SELECTORS ARE PURE SHAPING -----------------------------
    // Arrives with M6. Selectors turn derived data into view models. They may
    // read engine output; they must not render, fetch, or hold state.
    files: ['src/selectors/**/*.js'],
    ignores: ['src/selectors/**/__tests__/**'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: REACT_WORLD,
        patterns: [
          pattern('data', 'Selectors shape data they are given; they must not fetch.'),
          pattern('components', 'Selectors must not know about the UI.'),
          pattern('screens', 'Selectors must not know about the UI.'),
        ],
      }],
    },
  },

  {
    ignores: ['dist/**', 'dist-preview/**', 'node_modules/**', 'public/**'],
  },
];
