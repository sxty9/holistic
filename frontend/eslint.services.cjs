// Lockdown applied to services/<name>/ui/** — the teeth behind "service UIs may only
// reference holistic elements and may not render their own page".
// Self-contained: needs only eslint core + @typescript-eslint/parser (no extra plugins),
// so it is trivial to run in CI / the app build (`pnpm lint:services`).
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        // Raw HTML host elements (<div>, <span>, …) are forbidden — forces SDK layout primitives.
        selector: 'JSXOpeningElement[name.name=/^[a-z]/]',
        message:
          'Service UIs may not render raw HTML elements. Compose @holistic/ui components only (Stack, Box, Text, …).',
      },
      {
        selector: 'JSXAttribute[name.name="dangerouslySetInnerHTML"]',
        message: 'Raw HTML injection is forbidden in service UIs.',
      },
      {
        // Any bare (non-relative) import that is not react / react-dom / @holistic/ui.
        selector:
          'ImportDeclaration[source.value=/^[^.]/]:not([source.value=/^(react($|[-/])|@holistic\\/ui($|\\/))/])',
        message:
          'Service UIs may import only "@holistic/ui", "react", "react-dom", or local relative files.',
      },
    ],
    'no-restricted-globals': [
      'error',
      { name: 'fetch', message: 'Use the injected ServiceApiClient (props.api), not fetch.' },
      { name: 'XMLHttpRequest', message: 'Use the injected ServiceApiClient (props.api).' },
    ],
  },
};
