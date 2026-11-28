import { defineConfig } from 'oxlint'
import core from 'ultracite/oxlint/core'

// Ultracite's core preset, type-aware, with POWDER's react rules on top. Warnings fail (`--deny-warnings`).
// Every rule turned off or narrowed below says why; fix the code instead when a rule finds a real problem.
export default defineConfig({
  extends: [core],
  // core brings eslint, typescript, unicorn, oxc, import, jsdoc, node and promise; react is POWDER's own.
  plugins: [...(core.plugins ?? []), 'react'],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    // copied byte-identical from rat-stack so they can be re-synced (see .pi/extensions/git-interceptor/README.md)
    '.pi/**',
    '.claude/**',
    'scripts/hooks/**',
    'scripts/vcs-command-policy.js',
    'scripts/vcs-command-policy.d.ts',
    // workflow notes, not code
    '.agents/**',
  ],
  options: {
    typeAware: true,
  },
  rules: {
    'react/rules-of-hooks': 'error',
    'react/only-export-components': ['error', { allowConstantExport: true }],

    // House style, kept on purpose:
    // `function` declarations for components and sim helpers (hoisted, named in stack traces).
    'func-style': 'off',
    // one-line `if (cond) stmt` guards are how the sim reads; `curly` would double its length.
    curly: 'off',
    // tuning constants are documented with trailing comments (`turnRate: 2.4, // rad/s`), see config.ts.
    'no-inline-comments': 'off',
    // `type` aliases everywhere: most shapes are unions or intersections, which `interface` can't express.
    'typescript/consistent-type-definitions': 'off',
    // inline `type` specifiers (`import { stepSim, type Input }`); verbatimModuleSyntax already guarantees type-only imports are erased.
    'import/consistent-type-specifier-style': 'off',
    // `i++` loop counters and `++toastId`.
    'no-plusplus': 'off',
    // the sim resets groups of fields in one statement (`s.spin = s.flip = s.grabTime = 0`).
    'no-multi-assign': 'off',
    // braces only matter for `case`-scoped declarations, which `no-case-declarations` already catches.
    'unicorn/switch-case-braces': 'off',
    // switches over tagged unions (SimEvent) are checked for a missed case by the type-aware rule below;
    // a `default` branch would hide exactly that miss.
    'default-case': 'off',
    'typescript/switch-exhaustiveness-check': 'error',
    // PascalCase component files (Skier.tsx) and camelCase modules (cameraRig.ts).
    'unicorn/filename-case': ['error', { cases: { camelCase: true, pascalCase: true } }],
  },
  overrides: [
    {
      // mulberry32, the seeded course PRNG, is bit arithmetic by definition.
      files: ['src/game/course.ts'],
      rules: { 'no-bitwise': 'off' },
    },
    {
      // One ordered pass each: the sim step's if-chain is the skier's mode priority (crash > ground > air),
      // course generation is one seeded sequence (reordering it changes the map), and the skier pose is one
      // per-frame pass over its joints. Splitting them hides that order.
      files: ['src/game/sim.ts', 'src/game/course.ts', 'src/scene/Skier.tsx'],
      rules: { complexity: 'off' },
    },
    {
      // the sim's branches are ordered by mode priority (tumbling, riding, airborne; dirty landing before clean),
      // not positive-condition-first; flipping them to please the rule would hide that order.
      files: ['src/game/sim.ts'],
      rules: { 'unicorn/no-negated-condition': 'off' },
    },
    {
      // repo scripts follow rat-stack's kebab-case names (vcs-command-policy.js)
      files: ['scripts/**'],
      rules: { 'unicorn/filename-case': ['error', { cases: { kebabCase: true } }] },
    },
    {
      // helpers built for one test (`tapInAir`, `airFor`) read best right next to it.
      files: ['**/*.test.ts'],
      rules: { 'unicorn/consistent-function-scoping': 'off' },
    },
    {
      // R3F attaches `ref`s before the first `useFrame`, so `useRef<THREE.Group>(null!)` is the documented R3F pattern.
      files: ['src/scene/**/*.tsx'],
      rules: { 'typescript/no-non-null-assertion': 'off' },
    },
  ],
})
