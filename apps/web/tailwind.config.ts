import type { Config } from 'tailwindcss';

const config: Config = {
  /**
   * `class`, e a ausência disto era um defeito de tema inteiro.
   *
   * Sem `darkMode`, o Tailwind usa `'media'`: cada um dos 465 utilitários
   * `dark:` do projeto seguia o `prefers-color-scheme` do SISTEMA. Mas o
   * `ThemeProvider` usa `attribute="class"` com `enableSystem={false}` — ou
   * seja, o app decidiu de propósito IGNORAR a preferência do sistema e
   * escrever `class="light"` ou `class="dark"` no `<html>`.
   *
   * As duas metades do tema discordavam por construção:
   *   - as variáveis CSS (`--primary`, `--background`, ...) seguiam a CLASSE,
   *     que é a escolha da pessoa;
   *   - todo utilitário `dark:` seguia o SISTEMA, ignorando essa escolha.
   *
   * Em máquina com sistema no escuro e app no claro — que é o padrão, porque
   * `defaultTheme="light"` — saía fundo escuro de `dark:bg-*` combinado com
   * texto de tema claro. Medido em 14/11/2026 na página inicial: o aviso de
   * cookies ficava com `bg-gray-900` por baixo de `text-primary` do tema
   * claro, 3,40:1, enquanto `<html>` dizia `class="light"`.
   *
   * Não era só contraste: era o tema escuro vazando sobre o claro em 35
   * arquivos, para qualquer pessoa cujo sistema esteja no escuro.
   */
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        /**
         * Rampa fixa do teal clínico, no mesmo matiz de `--primary`.
         *
         * Desde 14/11/2026 o degrau de ação (`600`) e o token `--primary` do
         * tema claro são o MESMO valor — 164 72% 28%. Antes divergiam: a rampa
         * tinha sido corrigida para passar no WCAG AA e o token, não, então o
         * app autenticado reprovava em todo botão primário enquanto as páginas
         * públicas passavam. Se um dia voltarem a divergir, é defeito, não
         * escolha.
         *
         * Existe separada dos tokens porque as páginas públicas (landing e
         * legal) são deliberadamente claras — fixam `bg-white`/`text-gray-*` e
         * não acompanham o tema. Usar `bg-primary` nelas trocaria o tom no dark
         * mode sobre um fundo que continua branco, degradando o contraste.
         * Dentro do app autenticado, continue usando `bg-primary`/`text-primary`.
         */
        brand: {
          50: 'hsl(164 55% 96%)',
          100: 'hsl(164 50% 90%)',
          200: 'hsl(164 48% 80%)',
          300: 'hsl(164 46% 66%)',
          400: 'hsl(164 52% 48%)',
          500: 'hsl(164 60% 38%)',
          // 600 é o degrau de texto/botão: 28% de luminosidade dá 5,21:1 com
          // texto branco. O tom da marca em 34% rende 3,89:1 e reprova no AA.
          600: 'hsl(164 72% 28%)',
          700: 'hsl(164 76% 22%)',
          800: 'hsl(164 78% 17%)',
          900: 'hsl(164 80% 12%)',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        // Cor de TEXTO de aviso/erro. Separada de `destructive` porque aquele
        // par e solido (fundo + texto claro): usar o fundo como texto reprovava
        // contraste nos DOIS temas. Ver globals.css.
        danger: 'hsl(var(--danger))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

export default config;
