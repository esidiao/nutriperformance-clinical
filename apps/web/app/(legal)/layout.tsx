import Link from 'next/link';
import { ShieldCheck, ChevronRight } from 'lucide-react';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/login" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">NP</span>
            </div>
            <span className="text-sm font-bold text-gray-900">NutriPerformance Clinical</span>
          </Link>
          <Link href="/dashboard" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Voltar ao app <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-4xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
            Conforme LGPD (Lei 13.709/2018) · CFN · CONFEF
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <Link href="/legal/privacy" className="hover:text-blue-600">Privacidade</Link>
            <Link href="/legal/terms" className="hover:text-blue-600">Termos de Uso</Link>
            <Link href="/legal/cookies" className="hover:text-blue-600">Cookies</Link>
            <Link href="/legal/dados" className="hover:text-blue-600">Meus Dados</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
