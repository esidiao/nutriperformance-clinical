import parser from '@typescript-eslint/parser';
import jsxA11y from 'eslint-plugin-jsx-a11y';

/**
 * Configuração só de ACESSIBILIDADE.
 *
 * O nome do arquivo NÃO é `eslint.config.mjs` de propósito. Com esse nome, o
 * `next build` adota esta config como a config do projeto e passa a lintar
 * tudo com ela — e como ela não carrega os plugins `@next/next` nem
 * `react-hooks`, os comentários `eslint-disable` espalhados pelo código viram
 * "Definition for rule not found" e o BUILD QUEBRA. Foi o que aconteceu entre
 * 2afac17 e 14/11/2026: a catraca entrou verde e o build parou, porque eu
 * tinha deixado de rodar `next build` depois de acrescentar a config.
 *
 * Com o nome atual o Next usa a config dele, e a catraca aponta para esta via
 * `-c` explícito.
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
