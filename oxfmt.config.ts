import { defineConfig } from 'oxfmt'
import ultracite from 'ultracite/oxfmt'

export default defineConfig({
  ...ultracite,
  // POWDER's existing house style, kept so the switch to oxfmt doesn't rewrite every line:
  // no semicolons, single quotes, trailing commas everywhere, and wide lines for the dense sim and JSX code.
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 140,
  // keep the author's line breaks in markdown
  proseWrap: 'preserve',
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    // copied byte-identical from rat-stack so they can be re-synced
    '.pi/extensions/git-interceptor/**',
    'scripts/hooks/**',
    'scripts/vcs-command-policy.js',
    'scripts/vcs-command-policy.d.ts',
    // workflow notes and generated Blender output
    '.agents/**',
    'public/models/**',
  ],
})
