import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProvider } from '@/providers/QueryProvider';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NutriPerformance Clinical',
  description:
    'Plataforma SaaS de apoio integrado para Nutricionistas e Profissionais de Educação Física. ' +
    'Avaliação nutricional, composição corporal, suplementação, interações clínicas e relatórios.',
  robots: { index: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
