'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[DashboardError]', error.message, error.digest);
    }
  }, [error]);

  const isNetwork =
    error.message.toLowerCase().includes('fetch') ||
    error.message.toLowerCase().includes('network') ||
    error.message.toLowerCase().includes('tempo limite');

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {isNetwork ? 'Problema de conexão' : 'Algo deu errado'}
          </h1>
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">
            {isNetwork
              ? 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'
              : 'Ocorreu um erro inesperado. Se o problema persistir, entre em contato com o suporte.'}
          </p>
          {process.env.NODE_ENV !== 'production' && error.message && (
            <p className="mt-2 text-xs text-gray-400 font-mono bg-gray-50 rounded p-2 text-left break-all">
              {error.message}
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button onClick={reset} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Tentar novamente
          </Button>
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              Voltar ao início
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
