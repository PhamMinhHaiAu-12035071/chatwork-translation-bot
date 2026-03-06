import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    rules: {
      'no-restricted-imports': ['error', { patterns: ['../*'] }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.config.ts'],
  },
)
