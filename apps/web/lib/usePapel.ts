'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export const PAPEL_ESTUDANTE = 'supervised_student';

/**
 * Papel do usuário logado, lido da sessão do Supabase.
 *
 * Lê `app_metadata` com queda para `user_metadata`, na mesma ordem do
 * AuthGuard e do middleware — três lugares já faziam isso solto, e divergir
 * aqui produziria uma tela que mostra uma coisa e um backend que decide outra.
 *
 * A ordem é essa porque só `app_metadata` exige service-role para ser escrito;
 * `user_metadata` o próprio usuário grava. Com a precedência invertida, quem se
 * promovesse a 'admin' no navegador veria a interface de admin aparecer e levava
 * 403 em cada clique. A queda para `user_metadata` fica só para contas ainda não
 * migradas (ver apps/api/scripts/migrar-identidade-app-metadata.mjs).
 *
 * Serve para ADAPTAR a interface, nunca para autorizar: quem decide é o
 * RolesGuard no backend. Um papel forjado no navegador muda o que aparece na
 * tela e não muda nada do que a API aceita.
 */
export function usePapel() {
  const [papel, setPapel] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        const u = session?.user;
        setPapel(
          (u?.app_metadata?.role as string)
          ?? (u?.user_metadata?.role as string)
          ?? null,
        );
      })
      .finally(() => setCarregando(false));
  }, []);

  return {
    papel,
    carregando,
    souEstudante: papel === PAPEL_ESTUDANTE,
    /** Quem pode supervisionar — o mesmo conjunto do ClinicalStaff no backend. */
    souSupervisor: !!papel && [
      'admin', 'nutritionist', 'fitness_professional',
      'clinic_manager', 'institutional_manager',
    ].includes(papel),
  };
}
