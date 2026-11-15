import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { Toaster } from 'sonner';
import { QueryProvider } from '@/providers/QueryProvider';
import { CookieBanner } from '@/components/CookieBanner';
import './globals.css';

const font = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NutriPerformance Clinical',
  description:
    'Plataforma SaaS de apoio integrado para Nutricionistas e Profissionais de Educação Física. ' +
    'Avaliação nutricional, composição corporal, suplementação, interações clínicas e relatórios.',
  robots: { index: false },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'NutriPerf',
  },
};

export const viewport: Viewport = {
  themeColor: '#19917C',
  width: 'device-width',
  initialScale: 1,
};

/**
 * Ler `headers()` aqui é o que tira TODAS as rotas da geração estática, e isso
 * é deliberado: o nonce da CSP é por requisição, então HTML gravado no build
 * sairia com nonce velho ou sem nonce nenhum e o navegador bloquearia a
 * hidratação. O motivo completo está em `middleware.ts`.
 *
 * Se alguém reverter para `function RootLayout` sem `headers()`, as rotas voltam
 * a ser estáticas e o app quebra em produção — não aqui, onde o `next dev`
 * renderiza tudo por requisição de qualquer jeito.
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${font.variable} font-sans`}>
        <ThemeProvider nonce={nonce}>
          <QueryProvider>
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                duration: 4000,
                classNames: {
                  toast: 'font-sans text-sm',
                },
              }}
            />
          <CookieBanner />
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
