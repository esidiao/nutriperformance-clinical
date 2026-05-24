'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ShieldCheck, X } from 'lucide-react';

const STORAGE_KEY = 'np_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(STORAGE_KEY);
      if (!consent) setVisible(true);
    } catch {
      // localStorage indisponível (modo privado extremo) — não exibir
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accepted: true, date: new Date().toISOString() }));
    } catch { /* silent */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 sm:px-6"
    >
      <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
              Privacidade e Cookies
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Utilizamos apenas <strong>cookies essenciais</strong> para autenticação e funcionamento da plataforma.
              Não há rastreamento publicitário ou analytics de terceiros.
              Dados clínicos são protegidos por criptografia AES-256 conforme a{' '}
              <strong>LGPD (Lei 13.709/2018)</strong>.{' '}
              <Link href="/legal/privacy" className="text-blue-600 hover:underline">Política de Privacidade</Link>
              {' '}·{' '}
              <Link href="/legal/cookies" className="text-blue-600 hover:underline">Política de Cookies</Link>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <button
              onClick={accept}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              Entendido
            </button>
            <button
              onClick={accept}
              aria-label="Fechar"
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
