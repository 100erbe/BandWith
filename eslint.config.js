// Lint runs in CI. For now it enforces only the rules of hooks: a hook after
// an early return crashed EventDetail ("Rendered fewer hooks than expected").
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['dist/**', 'android/**', 'ios/**', 'node_modules/**', 'supabase/**', 'landing/**', 'splash/**'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    plugins: { 'react-hooks': reactHooks },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
    },
  },
);
