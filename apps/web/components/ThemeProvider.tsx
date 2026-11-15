'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';

/**
 * `nonce` vem do middleware, via header `x-nonce` lido no layout raiz.
 *
 * O next-themes emite um <script> inline que roda ANTES da primeira pintura
 * para aplicar o tema sem piscar. Com a CSP por nonce, esse script é o primeiro
 * a ser bloqueado se ficar sem a marca — e o sintoma não é erro, é o app abrir
 * sempre no tema claro. Por isso o nonce desce até aqui.
 */
export function ThemeProvider({
  children,
  nonce,
}: {
  children: React.ReactNode;
  nonce?: string;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      nonce={nonce}
    >
      {children}
    </NextThemesProvider>
  );
}
