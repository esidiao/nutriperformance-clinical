import type { Metadata, Viewport } from 'next';
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${font.variable} font-sans`}>
        <ThemeProvider>
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
