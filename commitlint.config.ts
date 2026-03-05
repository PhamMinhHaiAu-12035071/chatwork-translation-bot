import type { UserConfig } from '@commitlint/types'

const config: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'test',
        'chore',
        'perf',
        'ci',
        'build',
        'revert',
      ],
    ],
    'subject-case': [2, 'never', ['upper-case', 'pascal-case', 'start-case']],
    'scope-empty': [2, 'never'],
    'scope-enum': [2, 'always', ['core', 'translator', 'webhook-logger', 'repo']],
    'body-max-line-length': [2, 'always', 200],
  },
}

export default config
