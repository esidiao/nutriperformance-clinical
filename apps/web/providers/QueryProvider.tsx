'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { warmUp } from '@/lib/api-client';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  // A API hiberna no plano gratuito do Render. Dispara o /health assim que o
  // app monta para que ela acorde durante o login, e não na primeira tela
  // com dados — onde a espera ficaria visível.
  useEffect(() => { warmUp(); }, []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error: any) => {
              // Don't retry on 401/403
              if ([401, 403].includes(error?.status)) return false;
              // O api-client já reesperou o cold start; insistir aqui só
              // empilharia mais 75s de espera sobre um erro real.
              if (error?.status === 504) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
