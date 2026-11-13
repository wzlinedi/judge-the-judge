import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/', 'prototypes/', 'docs/schemas/'] },
  ...tseslint.configs.recommended,
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }] } },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['**/ui/**', '**/app/**', '**/sources/**', '@/ui/*', '@/app/*', '@/sources/*'], message: 'src/core must not import src/ui, src/app or src/sources (Principle III).' },
          ],
        },
      ],
    },
  },
);
