import { NextResponse } from 'next/server';

/**
 * Qual build do front está servindo. Pública, sem dado sensível.
 *
 * ============================== POR QUE EXISTE =============================
 *
 * A API tem `/health`, que devolve o commit — é por ele que se confere um
 * deploy do Render. O front não tinha equivalente, e a conferência era pelo
 * hash do CSS. Isso funciona enquanto a mudança mexe em estilo; em 29/10/2026
 * publiquei uma equação (só lógica) e o hash veio IGUAL ao do build anterior,
 * como tinha de vir. Tentei então achar o chunk da tela e buscá-lo em
 * produção: 404, porque o hash de conteúdo não é igual entre máquinas — e a
 * tela fica atrás do login, então nada público aponta para o chunk dela.
 *
 * Resultado: eu sabia QUAL deployment estava no ar, mas não tinha como provar
 * que o código esperado estava dentro. Esta rota fecha isso.
 *
 * ========================= O QUE DÁ PARA CONFERIR ==========================
 *
 * `implantacao` é o `VERCEL_DEPLOYMENT_ID`, que a CLI imprime ao publicar
 * (`dpl_...`). Bateu, é o build que você acabou de subir — sem depender de
 * estilo, de cache ou de adivinhação.
 *
 * `commit` só existe quando a Vercel recebe metadados de Git. Este projeto é
 * publicado pela CLI, sem `git connect`, então ele PODE vir nulo — e nulo é
 * resposta honesta, não falha. Quem decide é a plataforma, não este arquivo.
 *
 * ⚠️ Rota PÚBLICA, listada em `middleware.ts`. Só identificadores de build:
 * nada de variável de ambiente, segredo ou dado de paciente. Acrescentar
 * campo aqui é decidir publicá-lo para a internet inteira.
 */

// Sem cache: uma resposta guardada diria o build de ontem, que é justamente o
// erro que esta rota existe para impedir.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      implantacao: process.env.VERCEL_DEPLOYMENT_ID ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      ambiente: process.env.VERCEL_ENV ?? 'local',
      regiao: process.env.VERCEL_REGION ?? null,
      agora: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
