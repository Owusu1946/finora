import { defineConfig } from 'oxlint';

export default defineConfig({
  plugins: ['import', 'jsx-a11y', 'nextjs', 'react', 'typescript', 'unicorn', 'oxc'],
  categories: {
    correctness: 'error',
  },
  env: {
    builtin: true,
    browser: true,
    node: true,
  },
  settings: {
    next: {
      rootDir: '.',
    },
    react: {
      version: '19.1.0',
    },
  },
  ignorePatterns: ['.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  rules: {
    // eslint-config-next/core-web-vitals: @next/next recommended rules
    'nextjs/google-font-display': 'warn',
    'nextjs/google-font-preconnect': 'warn',
    'nextjs/next-script-for-ga': 'warn',
    'nextjs/no-async-client-component': 'warn',
    'nextjs/no-before-interactive-script-outside-document': 'warn',
    'nextjs/no-css-tags': 'warn',
    'nextjs/no-head-element': 'warn',
    'nextjs/no-img-element': 'warn',
    'nextjs/no-page-custom-font': 'warn',
    'nextjs/no-styled-jsx-in-document': 'warn',
    'nextjs/no-title-in-document-head': 'warn',
    'nextjs/no-typos': 'warn',
    'nextjs/no-unwanted-polyfillio': 'warn',
    'nextjs/inline-script-id': 'error',
    'nextjs/no-assign-module-variable': 'error',
    'nextjs/no-document-import-in-page': 'error',
    'nextjs/no-duplicate-head': 'error',
    'nextjs/no-head-import-in-document': 'error',
    'nextjs/no-script-component-in-head': 'error',
    // eslint-config-next/core-web-vitals: core-web-vitals rule overrides
    'nextjs/no-html-link-for-pages': 'error',
    'nextjs/no-sync-scripts': 'error',
    // eslint-config-next: react-hooks recommended rules
    'react/rules-of-hooks': 'error',
    'react/exhaustive-deps': 'warn',
    // eslint-config-next: react plugin overrides
    'react/no-unknown-property': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/jsx-no-target-blank': 'off',
    // eslint-config-next: jsx-a11y recommended rules
    'jsx-a11y/alt-text': ['warn', { elements: ['img'], img: ['Image'] }],
    'jsx-a11y/aria-props': 'warn',
    'jsx-a11y/aria-proptypes': 'warn',
    'jsx-a11y/aria-unsupported-elements': 'warn',
    'jsx-a11y/role-has-required-aria-props': 'warn',
    'jsx-a11y/role-supports-aria-props': 'warn',
    // eslint-config-next: import rules
    'import/no-anonymous-default-export': 'warn',
    // eslint-config-next/typescript: severity overrides
    'no-unused-vars': 'warn',
    'no-unused-expressions': 'warn',
  },
});
