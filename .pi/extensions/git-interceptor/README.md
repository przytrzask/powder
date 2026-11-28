# Git / jj interceptor (repo-local)

Pi extension auto-loaded from `.pi/extensions/git-interceptor/` when Pi starts in this repo.

- Blocks hook bypasses (`git … --no-verify`, `git commit -n`, `LEFTHOOK=0`, `core.hooksPath`, edits under `.git/hooks`) so agents can't skip the lefthook pre-commit fence (`pnpm check`, `pnpm test`).
- Forces non-interactive editors for `git` and `jj`.

Policy source: [`scripts/vcs-command-policy.js`](../../../scripts/vcs-command-policy.js).
The same policy is wired for Claude Code in [`.claude/settings.json`](../../../.claude/settings.json)
through [`scripts/hooks/block-git-no-verify.mjs`](../../../scripts/hooks/block-git-no-verify.mjs).

Copied from [joelhooks/rat-stack](https://github.com/joelhooks/rat-stack) at `c63350603f3e` (MIT).
`index.ts`, `policy.ts` and the two scripts are kept byte-identical to upstream so they can be re-synced;
they are excluded from oxlint and oxfmt for that reason.

The license for these copied files is in `scripts/LICENSE-rat-stack`.
