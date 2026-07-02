'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LogIn } from 'lucide-react';

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[AuthError]', error.message, error.digest);
    }
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Não foi possível carregar esta página</h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            Ocorreu um erro ao processar a autenticação. Tente novamente ou volte para a tela de login.
          </p>
          {process.env.NODE_ENV !== 'production' && error.message && (
            <p className="mt-2 text-xs text-gray-400 font-mono bg-gray-100 rounded p-2 text-left break-all">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
          <Link href="/login">
            <Button variant="outline" className="flex items-center gap-2">
              <LogIn className="h-4 w-4" /> Ir para o login
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
