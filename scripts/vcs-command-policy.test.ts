// Cases from rat-stack's packages/core/test/vcs-command-policy.test.ts (its Effect property tests left out).
import { describe, expect, it } from 'vitest'

import { applyCommandPolicy, HOOK_BYPASS_REASON, NONINTERACTIVE_VCS_ENV } from './vcs-command-policy.js'

const bypasses = [
  'git commit --no-verify -m wip',
  'git commit --no-verif -m wip',
  'git push --no-verify',
  'git merge --no-verify feature',
  "cd sub && git commit -m 'wip' --no-verify",
  '/usr/bin/git commit --no-verify',
  'git commit -n -m wip',
  'git commit -nm wip',
  'git commit -anm wip',
  'git commit -m wip -n',
  'git -C . commit -n',
  'git -c core.hooksPath=/dev/null commit -m wip',
  'git -c core.hookspath=/dev/null commit -m wip',
  'git config core.hooksPath .nohooks',
  'git config set core.hooksPath .nohooks',
  'LEFTHOOK=0 git commit -m wip',
  'LEFTHOOK=false git commit -m wip',
  'env LEFTHOOK=0 git commit -m wip',
  'export LEFTHOOK=0',
  'HUSKY=0 git commit -m wip',
  'LEFTHOOK_EXCLUDE=check git commit -m wip',
  'pnpm exec lefthook uninstall',
  'rm -rf .git/hooks',
  'echo exit 0 > .git/hooks/pre-commit',
  'cat noop >> .git/hooks/pre-commit',
  'chmod -x .git/hooks/pre-commit',
  'bash -c "git commit --no-verify"',
  "sh -c 'git commit -n -m wip'",
]

const ordinary = [
  'git status',
  "git commit -m 'add -n flag docs'",
  "git commit -m '--no-verify is banned'",
  'git commit -m wip',
  'git commit -am wip',
  'git commit -F msg.txt -- -n',
  'git commit --message -nope',
  'git commit --author -n -m wip',
  'git log -n 5',
  'git push -n origin main',
  'git add -n .',
  'git config --get core.hooksPath',
  'ls .git/hooks',
  'cat .git/hooks/pre-commit',
  'pnpm check',
  'grep -rn no-verify docs',
  'some-tool --no-verify',
  'LEFTHOOK=1 git commit -m wip',
]

describe('vcs command policy (agent guard against hook bypasses)', () => {
  it('leaves unrelated shell commands unchanged', () => {
    expect(applyCommandPolicy('pnpm test')).toEqual({ action: 'allow', command: 'pnpm test' })
  })

  it('prevents Git from opening an editor', () => {
    expect(applyCommandPolicy('cd repo && git rebase -i HEAD~2')).toEqual({
      action: 'allow',
      command: `${NONINTERACTIVE_VCS_ENV}cd repo && git rebase -i HEAD~2`,
    })
  })

  it('blocks every way to skip or disable the hooks', () => {
    expect(bypasses.filter((command) => applyCommandPolicy(command).action !== 'block')).toEqual([])
    expect(applyCommandPolicy('git commit -n -m wip')).toEqual({ action: 'block', reason: HOOK_BYPASS_REASON })
  })

  it('allows ordinary commands that only look like a bypass', () => {
    expect(ordinary.filter((command) => applyCommandPolicy(command).action !== 'allow')).toEqual([])
  })
})
