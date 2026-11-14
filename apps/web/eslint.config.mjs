import parser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * Configuração só de ACESSIBILIDADE.
 *
 * Não é o lint geral do projeto — não há um, e esta config não pretende ser.
 * Ela existe para a catraca de `scripts/catraca-a11y.mjs`, que compara o
 * resultado com a lista de ocorrências já conhecidas e falha apenas nas novas.
 *
 * O mapa de `components` abaixo é o que faz a regra enxergar alguma coisa:
 * sem ele o plugin vê `<Button>` e `<Input>` como componentes quaisquer e não
 * reporta nada. Foi assim que 92 campos sem rótulo conviveram com o projeto
 * até 14/11/2026.
 */
export default [
  {
    files: ['app/**/*.tsx', 'components/**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'jsx-a11y': jsxA11y },
    settings: {
      'jsx-a11y': {
        polymorphicPropName: 'as',
        components: {
          Button: 'button',
          Input: 'input',
          Textarea: 'textarea',
          Select: 'select',
          Label: 'label',
          Image: 'img',
          Link: 'a',
        },
      },
    },
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
];
